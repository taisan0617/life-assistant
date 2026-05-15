import { useState } from "react";
import { startChatStream } from "../lib/api";
import { parseNDJSONStream } from "../lib/ndjson";
import type { Message, ToolCall } from "../lib/types";

export function useStreamingChat() {
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const updateLastMessage = (updater: (prev: Message) => Message) => {
    setMessages((prev) => {
      const copy = [...prev];
      copy[copy.length - 1] = updater(copy[copy.length - 1]);
      return copy;
    });
  };

  const sendMessage = async (
    text: string,
    sessionId: string | null,
    onSessionCreated: (sessionId: string) => void,
    idToken: string
  ) => {
    const userMessage: Message = {
      role: "user", content: text, createdAt: new Date().toISOString(),
    };
    const assistantPlaceholder: Message = {
      role: "assistant", content: "", toolCalls: [], createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setIsStreaming(true);

    const toolCallsMap = new Map<string, ToolCall>();

    try {
      const reader = await startChatStream(text, sessionId, idToken);

      for await (const event of parseNDJSONStream(reader)) {
        switch (event.type) {
          case "thinking":
            updateLastMessage((msg) => ({ ...msg, thinking: event.text }));
            break;

          case "tool_start":
            toolCallsMap.set(event.id, {
              id: event.id, actionGroup: event.actionGroup,
              function: event.function, parameters: event.parameters,
              startedAt: event.startedAt,
            });
            updateLastMessage((msg) => ({ ...msg, toolCalls: Array.from(toolCallsMap.values()) }));
            break;

          case "tool_end": {
            const existing = toolCallsMap.get(event.id);
            if (existing) {
              toolCallsMap.set(event.id, { ...existing, result: event.result, endedAt: event.endedAt });
            }
            updateLastMessage((msg) => ({ ...msg, toolCalls: Array.from(toolCallsMap.values()) }));
            break;
          }

          case "chunk":
            updateLastMessage((msg) => ({ ...msg, content: msg.content + event.text }));
            break;

          case "done":
            onSessionCreated(event.sessionId);
            break;

          case "error":
            updateLastMessage((msg) => ({ ...msg, content: `エラー: ${event.message}` }));
            break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "不明なエラー";
      updateLastMessage((msg) => ({ ...msg, content: `ネットワークエラー: ${message}` }));
    } finally {
      setIsStreaming(false);
    }
  };

  const loadSession = (loaded: Message[]) => setMessages(loaded);
  const newChat     = ()                  => setMessages([]);

  return { messages, isStreaming, sendMessage, loadSession, newChat };
}
