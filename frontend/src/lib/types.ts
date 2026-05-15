// ─── ストリーミングイベント ────────────────────────────────────────────────────

export type StreamEvent =
  | { type: "thinking"; text: string }
  | {
      type: "tool_start";
      id: string;
      actionGroup: string;
      function: string;
      parameters: Record<string, string>;
      startedAt: string;
    }
  | { type: "tool_end"; id: string; result: unknown; endedAt: string }
  | { type: "chunk"; text: string }
  | { type: "done"; messageId: string; sessionId: string }
  | { type: "error"; message: string };

// ─── ツール呼び出し ────────────────────────────────────────────────────────────

export interface ToolCall {
  id: string;
  actionGroup: string;
  function: string;
  parameters: Record<string, string>;
  result?: unknown;
  startedAt: string;
  endedAt?: string;
}

// ─── チャットメッセージ ────────────────────────────────────────────────────────

export interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  thinking?: string;
  createdAt: string;
}

// ─── 会話サマリー ──────────────────────────────────────────────────────────────

export interface SessionSummary {
  sessionId: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
}

// ─── 認証ユーザー ──────────────────────────────────────────────────────────────

export interface AuthUser {
  email: string;
  sub: string;
}
