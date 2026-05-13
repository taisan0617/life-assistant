import { useState, useEffect } from "react";
import { fetchSessions } from "../lib/api";
import type { SessionSummary } from "../lib/types";

/**
 * 会話一覧の取得と管理を行う hook。
 * マウント時に自動でロードし、loadSessions() を呼ぶと再取得できる。
 */
export function useSessions() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSessions();
      setSessions(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "不明なエラー";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  return { sessions, isLoading, error, loadSessions };
}
