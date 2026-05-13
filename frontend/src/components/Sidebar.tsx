import { X } from "lucide-react";
import { NewChatButton } from "./NewChatButton";
import { SessionList } from "./SessionList";
import type { SessionSummary } from "../lib/types";

interface Props {
  sessions: SessionSummary[];
  currentSessionId: string | null;
  isLoading: boolean;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * サイドバー。
 * デスクトップ: 常に表示（固定幅 280px）
 * モバイル: isOpen=true のときドロワーとして表示
 */
export function Sidebar({
  sessions,
  currentSessionId,
  isLoading,
  onSelectSession,
  onNewChat,
  isOpen,
  onClose,
}: Props) {
  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-30 flex flex-col w-72 bg-white border-r border-gray-200
        transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0 md:z-auto
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <h1 className="font-semibold text-gray-800 text-sm">Life Assistant</h1>
        {/* モバイルの閉じるボタン */}
        <button
          onClick={onClose}
          className="md:hidden p-1 rounded text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 新しい会話ボタン */}
      <div className="px-3 py-3">
        <NewChatButton onClick={onNewChat} />
      </div>

      {/* 会話一覧（スクロール領域） */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 pb-2">
        <p className="px-4 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
          履歴
        </p>
        <SessionList
          sessions={sessions}
          currentSessionId={currentSessionId}
          isLoading={isLoading}
          onSelect={(sid) => {
            onSelectSession(sid);
            onClose();
          }}
        />
      </div>

      {/* フッター */}
      <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
        Phase 3 — Bedrock Agent UI
      </div>
    </aside>
  );
}
