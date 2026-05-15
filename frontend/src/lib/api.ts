import type { Message, SessionSummary } from "./types";

const CHAT_STREAM_URL = import.meta.env.VITE_CHAT_STREAM_URL as string;
const HISTORY_API_URL = import.meta.env.VITE_HISTORY_API_URL as string;

// ─── ストリーミングチャット ────────────────────────────────────────────────────

/**
 * Lambda Function URL に POST し、ReadableStream reader を返す。
 * 呼び出し元は parseNDJSONStream に渡してイベントを逐次受け取る。
 */
export async function startChatStream(
  message: string,
  sessionId: string | null,
  idToken: string
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const body: Record<string, string> = { message };
  if (sessionId) body.sessionId = sessionId;

  const res = await fetch(CHAT_STREAM_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`チャット送信エラー: HTTP ${res.status}`);
  if (!res.body) throw new Error("レスポンスボディが空です");

  return res.body.getReader();
}

// ─── 履歴 API ─────────────────────────────────────────────────────────────────

/** 会話一覧を取得する（最新順）。 */
export async function fetchSessions(idToken: string): Promise<SessionSummary[]> {
  const res = await fetch(`${HISTORY_API_URL}/sessions`, {
    headers: { "Authorization": `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`会話一覧の取得失敗: HTTP ${res.status}`);
  const data = (await res.json()) as { sessions: SessionSummary[] };
  return data.sessions;
}

/** 指定セッションの全メッセージを取得する。 */
export async function fetchSession(
  sessionId: string,
  idToken: string
): Promise<Message[]> {
  const res = await fetch(`${HISTORY_API_URL}/sessions/${sessionId}`, {
    headers: { "Authorization": `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`メッセージ取得失敗: HTTP ${res.status}`);
  const data = (await res.json()) as { messages: Message[] };
  return data.messages;
}
