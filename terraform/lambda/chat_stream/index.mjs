/**
 * chat-stream Lambda handler — Lambda Function URL / RESPONSE_STREAM mode.
 *
 * 認証:
 *   - Authorization: Bearer <CognitoIdToken> ヘッダーで受け取り、aws-jwt-verify で検証
 *   - 検証成功後は JWT の sub をユーザー ID として使用
 *   - ALLOW_UNAUTHENTICATED=true のとき、ヘッダーなしの場合は "default-user" にフォールバック
 *     （ローカルデバッグ・学習環境用。本番では false にすること）
 *
 * NDJSON プロトコル (1行 = 1イベント):
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
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { randomUUID } from "crypto";

const AGENT_ID             = process.env.AGENT_ID;
const AGENT_ALIAS_ID       = process.env.AGENT_ALIAS_ID;
const TABLE_NAME           = process.env.DYNAMODB_TABLE;
const ALLOW_UNAUTHENTICATED = process.env.ALLOW_UNAUTHENTICATED === "true";
const DEBUG_TRACE          = process.env.DEBUG_TRACE === "true";

const bedrock = new BedrockAgentRuntimeClient({});
const ddb     = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Cognito JWT Verifier をモジュールスコープで生成し、JWKs キャッシュをコールド間で再利用する
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse:   "id",
  clientId:   process.env.COGNITO_APP_CLIENT_ID,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nowIso = () => new Date().toISOString();

const ndjson = (data) => JSON.stringify(data) + "\n";

/** イベントループに制御を返してバッファ書き出しを促す。 */
const flush = () => new Promise((r) => setImmediate(r));

function parseToolResult(rawText) {
  if (!rawText) return null;
  try { return JSON.parse(rawText); } catch { return rawText; }
}

// ─── DynamoDB Operations ───────────────────────────────────────────────────────

async function ensureSession(sessionId, userId, firstMessage) {
  try {
    await ddb.send(new PutCommand({
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
    }));
  } catch (err) {
    if (err.name !== "ConditionalCheckFailedException") throw err;
  }
}

async function saveMessage(sessionId, role, content, toolCalls) {
  const messageId = randomUUID();
  const ts        = nowIso();
  await ddb.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `SESSION#${sessionId}`, SK: `MSG#${ts}#${messageId}`,
      sessionId, messageId, role, content, toolCalls, createdAt: ts,
    },
  }));
  return messageId;
}

async function updateSessionMeta(sessionId, userId, lastResponse) {
  await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: `USER#${userId}`, SK: `SESSION#${sessionId}` },
    UpdateExpression: "SET updatedAt = :u, lastMessage = :l",
    ExpressionAttributeValues: { ":u": nowIso(), ":l": lastResponse.slice(0, 100) },
  }));
}

// ─── JWT 検証ヘルパー ─────────────────────────────────────────────────────────

/**
 * Authorization ヘッダーから Bearer トークンを取り出して検証する。
 * 成功時は { userId } を返す。
 * 失敗時は { error } を返す（呼び出し元が 401 応答を返すべき）。
 */
async function authenticate(headers) {
  const authHeader = headers?.authorization ?? headers?.Authorization ?? "";
  const token      = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    if (ALLOW_UNAUTHENTICATED) {
      return { userId: "default-user" };
    }
    return { error: "Unauthorized: Authorization header required" };
  }

  try {
    const payload = await verifier.verify(token);
    return { userId: payload.sub };
  } catch (err) {
    return { error: `Unauthorized: ${err.message}` };
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export const handler = awslambda.streamifyResponse(
  async (event, responseStream, _context) => {

    // ── JWT 検証（HttpResponseStream 作成前に行い、401 を正しく返す） ─────────
    const auth = await authenticate(event.headers ?? {});
    if (auth.error) {
      const errStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 401,
        headers: { "Content-Type": "application/x-ndjson" },
      });
      errStream.write(ndjson({ type: "error", message: auth.error }));
      errStream.end();
      return;
    }
    const userId = auth.userId;

    // ── 認証済み: ストリーミング応答の準備 ──────────────────────────────────
    const stream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers: { "Content-Type": "application/x-ndjson" },
    });

    // ── リクエストボディのパース ─────────────────────────────────────────────
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
    await ensureSession(sessionId, userId, message);

    // ── Bedrock Agent 呼び出し ───────────────────────────────────────────────
    let agentResponse;
    try {
      agentResponse = await bedrock.send(new InvokeAgentCommand({
        agentId:      AGENT_ID,
        agentAliasId: AGENT_ALIAS_ID,
        sessionId,
        inputText:    message,
        enableTrace:  true,
      }));
    } catch (err) {
      stream.write(ndjson({ type: "error", message: `Bedrock invoke failed: ${err.message}` }));
      stream.end();
      return;
    }

    // ── trace / chunk をストリーミング ───────────────────────────────────────
    let accumulatedText   = "";
    let toolCallCounter   = 0;
    let pendingToolCallId = null;
    const toolCallsMap    = new Map();

    try {
      for await (const ev of agentResponse.completion) {
        if (DEBUG_TRACE && ev.trace) {
          console.log("RAW TRACE:", JSON.stringify(ev.trace, null, 2));
        }

        const orch = ev.trace?.trace?.orchestrationTrace;

        if (orch?.rationale?.text) {
          stream.write(ndjson({ type: "thinking", text: orch.rationale.text }));
          await flush();
        }

        const agi = orch?.invocationInput?.actionGroupInvocationInput;
        if (agi) {
          toolCallCounter++;
          const id         = `call-${toolCallCounter}`;
          const startedAt  = nowIso();
          const parameters = Object.fromEntries(
            (agi.parameters ?? []).map((p) => [p.name, p.value])
          );
          pendingToolCallId = id;
          toolCallsMap.set(id, {
            id, actionGroup: agi.actionGroupName, function: agi.apiPath ?? agi.function,
            parameters, startedAt, result: null, endedAt: null,
          });
          console.log(`tool_start ${id}: ${agi.actionGroupName} ${agi.apiPath ?? agi.function}`);
          stream.write(ndjson({
            type: "tool_start", id,
            actionGroup: agi.actionGroupName, function: agi.apiPath ?? agi.function,
            parameters, startedAt,
          }));
          await flush();
        }

        const agio = orch?.observation?.actionGroupInvocationOutput;
        if (agio && pendingToolCallId) {
          const id      = pendingToolCallId;
          const endedAt = nowIso();
          const result  = parseToolResult(agio.text);
          const entry   = toolCallsMap.get(id);
          if (entry) { entry.result = result; entry.endedAt = endedAt; }
          console.log(`tool_end ${id}`);
          stream.write(ndjson({ type: "tool_end", id, result, endedAt }));
          await flush();
          pendingToolCallId = null;
        }

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

    // ── DynamoDB に保存 ──────────────────────────────────────────────────────
    const toolCalls = Array.from(toolCallsMap.values());
    try {
      await saveMessage(sessionId, "user",      message,          []);
      const messageId = await saveMessage(sessionId, "assistant", accumulatedText, toolCalls);
      await updateSessionMeta(sessionId, userId, accumulatedText);
      stream.write(ndjson({ type: "done", messageId, sessionId }));
    } catch (err) {
      stream.write(ndjson({ type: "error", message: `DynamoDB write failed: ${err.message}` }));
    }

    stream.end();
  }
);
