/**
 * chat-stream Lambda handler — Lambda Function URL / RESPONSE_STREAM mode.
 *
 * Bedrock Agent returns the final answer as a single chunk, but traces arrive
 * incrementally. This handler streams progress events so the frontend can show
 * live tool call activity while waiting for the final response.
 *
 * NDJSON protocol (one JSON object per line):
 *   {"type":"thinking",  "text":"..."}
 *   {"type":"tool_start","id":"call-N","actionGroup":"...","function":"...","parameters":{...},"startedAt":"ISO"}
 *   {"type":"tool_end",  "id":"call-N","result":...,"endedAt":"ISO"}
 *   {"type":"chunk",     "text":"..."}
 *   {"type":"done",      "messageId":"...","sessionId":"..."}
 *   {"type":"error",     "message":"..."}
 */

import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const AGENT_ID        = process.env.AGENT_ID;
const AGENT_ALIAS_ID  = process.env.AGENT_ALIAS_ID;
const TABLE_NAME      = process.env.DYNAMODB_TABLE;
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID;
const DEBUG_TRACE     = process.env.DEBUG_TRACE === "true";

const bedrock = new BedrockAgentRuntimeClient({});
const ddb     = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nowIso = () => new Date().toISOString();

const ndjson = (data) => JSON.stringify(data) + "\n";

/** Yield to the event loop so Node.js flushes buffered stream writes. */
const flush = () => new Promise((r) => setImmediate(r));

function parseToolResult(rawText) {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

// ─── DynamoDB Operations ───────────────────────────────────────────────────────

async function ensureSession(sessionId, userId, firstMessage) {
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK:          `USER#${userId}`,
          SK:          `SESSION#${sessionId}`,
          userId,
          sessionId,
          title:       firstMessage.slice(0, 30),
          createdAt:   nowIso(),
          updatedAt:   nowIso(),
          lastMessage: "",
        },
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
  } catch (err) {
    if (err.name !== "ConditionalCheckFailedException") throw err;
  }
}

async function saveMessage(sessionId, role, content, toolCalls) {
  const messageId = randomUUID();
  const ts        = nowIso();
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK:        `SESSION#${sessionId}`,
        SK:        `MSG#${ts}#${messageId}`,
        sessionId,
        messageId,
        role,
        content,
        toolCalls,
        createdAt: ts,
      },
    })
  );
  return messageId;
}

async function updateSessionMeta(sessionId, userId, lastResponse) {
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `SESSION#${sessionId}`,
      },
      UpdateExpression: "SET updatedAt = :u, lastMessage = :l",
      ExpressionAttributeValues: {
        ":u": nowIso(),
        ":l": lastResponse.slice(0, 100),
      },
    })
  );
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export const handler = awslambda.streamifyResponse(
  async (event, responseStream, _context) => {
    const stream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers: { "Content-Type": "application/x-ndjson" },
    });

    // ── Parse request body ───────────────────────────────────────────────────
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf-8")
      : event.body;

    let body;
    try {
      body = JSON.parse(rawBody || "{}");
    } catch (e) {
      console.error("JSON parse error:", e.message, "rawBody:", rawBody);
      stream.write(ndjson({ type: "error", message: "Invalid JSON body" }));
      stream.end();
      return;
    }

    const message = (body.message ?? "").trim();
    if (!message) {
      stream.write(ndjson({ type: "error", message: "'message' field is required" }));
      stream.end();
      return;
    }

    const sessionId = body.sessionId || randomUUID();
    const userId    = DEFAULT_USER_ID;

    await ensureSession(sessionId, userId, message);

    // ── Invoke Bedrock Agent ─────────────────────────────────────────────────
    let agentResponse;
    try {
      agentResponse = await bedrock.send(
        new InvokeAgentCommand({
          agentId:      AGENT_ID,
          agentAliasId: AGENT_ALIAS_ID,
          sessionId,
          inputText:    message,
          enableTrace:  true,
        })
      );
    } catch (err) {
      stream.write(ndjson({ type: "error", message: `Bedrock invoke failed: ${err.message}` }));
      stream.end();
      return;
    }

    // ── Stream traces and final chunk ────────────────────────────────────────
    let accumulatedText  = "";
    let toolCallCounter  = 0;
    let pendingToolCallId = null;

    // Accumulates completed tool calls for DynamoDB storage.
    // key = call-N, value = { id, actionGroup, function, parameters, startedAt, result, endedAt }
    const toolCallsMap = new Map();

    try {
      for await (const ev of agentResponse.completion) {
        // ── Debug: raw trace dump ──────────────────────────────────────────
        if (DEBUG_TRACE && ev.trace) {
          console.log("RAW TRACE:", JSON.stringify(ev.trace, null, 2));
        }

        const orch = ev.trace?.trace?.orchestrationTrace;

        // ── thinking ──────────────────────────────────────────────────────
        if (orch?.rationale?.text) {
          const text = orch.rationale.text;
          console.log("thinking:", text.substring(0, 80));
          stream.write(ndjson({ type: "thinking", text }));
          await flush();
        }

        // ── tool_start ────────────────────────────────────────────────────
        const agi = orch?.invocationInput?.actionGroupInvocationInput;
        if (agi) {
          toolCallCounter++;
          const id         = `call-${toolCallCounter}`;
          const startedAt  = nowIso();
          const parameters = Object.fromEntries(
            (agi.parameters ?? []).map((p) => [p.name, p.value])
          );
          const payload = {
            type: "tool_start",
            id,
            actionGroup: agi.actionGroupName,
            function:    agi.apiPath ?? agi.function,
            parameters,
            startedAt,
          };
          pendingToolCallId = id;
          toolCallsMap.set(id, {
            id,
            actionGroup: payload.actionGroup,
            function:    payload.function,
            parameters,
            startedAt,
            result:      null,
            endedAt:     null,
          });
          console.log(`tool_start ${id}: ${payload.actionGroup} ${payload.function}`);
          stream.write(ndjson(payload));
          await flush();
        }

        // ── tool_end ──────────────────────────────────────────────────────
        const agio = orch?.observation?.actionGroupInvocationOutput;
        if (agio && pendingToolCallId) {
          const id      = pendingToolCallId;
          const endedAt = nowIso();
          const result  = parseToolResult(agio.text);
          const entry   = toolCallsMap.get(id);
          if (entry) {
            entry.result  = result;
            entry.endedAt = endedAt;
          }
          console.log(`tool_end ${id}`);
          stream.write(ndjson({ type: "tool_end", id, result, endedAt }));
          await flush();
          pendingToolCallId = null;
        }

        // ── final chunk ───────────────────────────────────────────────────
        if (ev.chunk) {
          const text = new TextDecoder().decode(ev.chunk.bytes);
          accumulatedText += text;
          console.log("chunk:", text.substring(0, 80));
          stream.write(ndjson({ type: "chunk", text }));
          await flush();
        }
      }
    } catch (err) {
      stream.write(ndjson({ type: "error", message: `Stream error: ${err.message}` }));
      stream.end();
      return;
    }

    // ── Persist conversation to DynamoDB ─────────────────────────────────────
    const toolCalls = Array.from(toolCallsMap.values());
    try {
      await saveMessage(sessionId, "user",      message,          []);
      const messageId = await saveMessage(
        sessionId, "assistant", accumulatedText, toolCalls
      );
      await updateSessionMeta(sessionId, userId, accumulatedText);
      stream.write(ndjson({ type: "done", messageId, sessionId }));
    } catch (err) {
      stream.write(ndjson({ type: "error", message: `DynamoDB write failed: ${err.message}` }));
    }

    stream.end();
  }
);
