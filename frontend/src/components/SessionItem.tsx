import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { MessageSquare } from "lucide-react";
import type { SessionSummary } from "../lib/types";

interface Props {
  session: SessionSummary;
  isActive: boolean;
  onClick: () => void;
}

/** サイドバーの会話一覧の1アイテム。 */
export function SessionItem({ session, isActive, onClick }: Props) {
  const timeAgo = formatDistanceToNow(new Date(session.updatedAt), {
    addSuffix: true,
    locale: ja,
  });

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors group
        ${isActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}
    >
      <div className="flex items-start gap-2">
        <MessageSquare
          className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isActive ? "text-blue-500" : "text-gray-400"}`}
        />
        <div className="min-w-0">
          {/* タイトル（最初の質問の冒頭30文字） */}
          <p className="text-sm font-medium truncate">{session.title || "無題の会話"}</p>
          {/* 最終メッセージの冒頭と相対時刻 */}
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {timeAgo}
          </p>
        </div>
      </div>
    </button>
  );
}
