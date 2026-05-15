import { useState, useEffect } from "react";
import { fetchSessions } from "../lib/api";
import type { SessionSummary } from "../lib/types";

/**
 * 会話一覧の取得と管理を行う hook。
 * idToken が null のとき（未ログイン）はリクエストしない。
 * idToken が変わる（ログイン完了）と自動でロードする。
 */
export function useSessions(idToken: string | null) {
  const [sessions,  setSessions]  = useState<SessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const loadSessions = async () => {
    if (!idToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSessions(idToken);
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "不明なエラー");
    } finally {
      setIsLoading(false);
    }
  };

  // idToken が確定したら（ログイン直後・セッション復元後）自動でロード
  useEffect(() => {
    loadSessions();
  }, [idToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return { sessions, isLoading, error, loadSessions };
}
