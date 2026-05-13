import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { useStreamingChat } from "./hooks/useStreamingChat";
import { useSessions } from "./hooks/useSessions";
import { fetchSessionMessages } from "./lib/api";

/**
 * アプリケーションのルートコンポーネント。
 *
 * 状態管理:
 * - currentSessionId: 現在表示中のセッション ID（null = 新規会話）
 * - sidebarOpen: モバイル用ドロワーの開閉状態
 *
 * データフロー:
 * useSessions → Sidebar（会話一覧）
 * useStreamingChat → ChatView（メッセージ一覧＋入力フォーム）
 */
export default function App() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { sessions, isLoading: sessionsLoading, loadSessions } = useSessions();
  const { messages, isStreaming, sendMessage, loadSession, newChat } = useStreamingChat();

  // ── 会話切り替え ──────────────────────────────────────────────────────────
  const handleSelectSession = async (sessionId: string) => {
    if (sessionId === currentSessionId) return;
    setCurrentSessionId(sessionId);
    setSidebarOpen(false);
    try {
      const msgs = await fetchSessionMessages(sessionId);
      loadSession(msgs);
    } catch (err) {
      console.error("履歴の読み込みに失敗:", err);
    }
  };

  // ── 新規会話 ──────────────────────────────────────────────────────────────
  const handleNewChat = () => {
    setCurrentSessionId(null);
    newChat();
    setSidebarOpen(false);
  };

  // ── メッセージ送信 ────────────────────────────────────────────────────────
  const handleSendMessage = async (text: string) => {
    await sendMessage(text, currentSessionId, (newSessionId) => {
      // done イベントで新しい sessionId が確定したらセットし、サイドバーを更新
      setCurrentSessionId(newSessionId);
      loadSessions();
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* モバイル用オーバーレイ（サイドバー外側をタップで閉じる） */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* サイドバー */}
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        isLoading={sessionsLoading}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* メインエリア */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* モバイル用ヘッダー（サイドバー開閉ボタン） */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b bg-white">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 rounded text-gray-500 hover:text-gray-800"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="font-semibold text-gray-800 text-sm">Life Assistant</h1>
        </header>

        <ChatView
          messages={messages}
          isStreaming={isStreaming}
          onSendMessage={handleSendMessage}
        />
      </div>
    </div>
  );
}
