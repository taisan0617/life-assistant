import { useState } from "react";
import { startChatStream } from "../lib/api";
import { parseNDJSONStream } from "../lib/ndjson";
import type { Message, ToolCall } from "../lib/types";

/**
 * チャット送信とストリーミング受信を管理する hook。
 *
 * sendMessage を呼ぶと:
 * 1. ユーザーメッセージを即座に messages に追加
 * 2. アシスタントのプレースホルダーを追加
 * 3. StreamEvent を受け取るたびにプレースホルダーを更新
 *    - thinking → message.thinking
 *    - tool_start / tool_end → message.toolCalls（Map でペアリング）
 *    - chunk → message.content に追記
 * 4. done を受信したら onSessionCreated コールバックで sessionId を通知
 */
export function useStreamingChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // 末尾のアシスタントメッセージを部分的に更新するヘルパー
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
    onSessionCreated: (sessionId: string) => void
  ) => {
    // ── ユーザーメッセージを追加 ─────────────────────────────────────────────
    const userMessage: Message = {
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    // アシスタントのプレースホルダー（空の状態でレンダリング開始）
    const assistantPlaceholder: Message = {
      role: "assistant",
      content: "",
      toolCalls: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setIsStreaming(true);

    // ── ローカル状態（ストリーミング中に蓄積） ──────────────────────────────
    // toolCalls は Map で管理し、tool_start と tool_end をペアリングする
    const toolCallsMap = new Map<string, ToolCall>();

    try {
      const reader = await startChatStream(text, sessionId);

      for await (const event of parseNDJSONStream(reader)) {
        switch (event.type) {
          case "thinking":
            updateLastMessage((msg) => ({ ...msg, thinking: event.text }));
            break;

          case "tool_start":
            toolCallsMap.set(event.id, {
              id: event.id,
              actionGroup: event.actionGroup,
              function: event.function,
              parameters: event.parameters,
              startedAt: event.startedAt,
            });
            updateLastMessage((msg) => ({
              ...msg,
              toolCalls: Array.from(toolCallsMap.values()),
            }));
            break;

          case "tool_end": {
            const existing = toolCallsMap.get(event.id);
            if (existing) {
              toolCallsMap.set(event.id, {
                ...existing,
                result: event.result,
                endedAt: event.endedAt,
              });
            }
            updateLastMessage((msg) => ({
              ...msg,
              toolCalls: Array.from(toolCallsMap.values()),
            }));
            break;
          }

          case "chunk":
            updateLastMessage((msg) => ({
              ...msg,
              content: msg.content + event.text,
            }));
            break;

          case "done":
            onSessionCreated(event.sessionId);
            break;

          case "error":
            updateLastMessage((msg) => ({
              ...msg,
              content: `エラー: ${event.message}`,
            }));
            break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "不明なエラー";
      updateLastMessage((msg) => ({
        ...msg,
        content: `ネットワークエラー: ${message}`,
      }));
    } finally {
      setIsStreaming(false);
    }
  };

  /** 既存セッションの履歴を読み込む（会話切り替え時に使用）。 */
  const loadSession = (loaded: Message[]) => {
    setMessages(loaded);
  };

  /** 新規会話を開始する。 */
  const newChat = () => {
    setMessages([]);
  };

  return { messages, isStreaming, sendMessage, loadSession, newChat };
}
