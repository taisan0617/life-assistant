import { SessionItem } from "./SessionItem";
import type { SessionSummary } from "../lib/types";

interface Props {
  sessions: SessionSummary[];
  currentSessionId: string | null;
  isLoading: boolean;
  onSelect: (sessionId: string) => void;
}

/** 会話一覧。縦スクロール対応。 */
export function SessionList({ sessions, currentSessionId, isLoading, onSelect }: Props) {
  if (isLoading) {
    return (
      <div className="px-3 py-4 text-xs text-gray-400 text-center">
        読み込み中…
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-gray-400 text-center">
        会話履歴はありません
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto flex-1 px-2">
      {sessions.map((session) => (
        <SessionItem
          key={session.sessionId}
          session={session}
          isActive={session.sessionId === currentSessionId}
          onClick={() => onSelect(session.sessionId)}
        />
      ))}
    </div>
  );
}
