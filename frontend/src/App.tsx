import { useState } from "react";
import { Menu, Loader2 } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { LoginForm } from "./components/LoginForm";
import { useAuth } from "./hooks/useAuth";
import { useStreamingChat } from "./hooks/useStreamingChat";
import { useSessions } from "./hooks/useSessions";
import { fetchSession } from "./lib/api";

/**
 * アプリケーションのルートコンポーネント。
 *
 * 認証フロー:
 *   isLoading=true  → セッション復元中のスピナー
 *   isAuthenticated=false → LoginForm
 *   isAuthenticated=true  → チャット画面（Sidebar + ChatView）
 */
export default function App() {
  const { isAuthenticated, isLoading, user, idToken, login, logout, error } = useAuth();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen,      setSidebarOpen]      = useState(false);

  // idToken が null のとき useSessions は自動スキップする
  const { sessions, isLoading: sessionsLoading, loadSessions } = useSessions(idToken);
  const { messages, isStreaming, sendMessage, loadSession, newChat } = useStreamingChat();

  // ── 会話切り替え ──────────────────────────────────────────────────────────
  const handleSelectSession = async (sessionId: string) => {
    if (sessionId === currentSessionId || !idToken) return;
    setCurrentSessionId(sessionId);
    setSidebarOpen(false);
    try {
      const msgs = await fetchSession(sessionId, idToken);
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
    if (!idToken) return;
    await sendMessage(text, currentSessionId, (newSessionId) => {
      setCurrentSessionId(newSessionId);
      loadSessions();
    }, idToken);
  };

  // ── セッション復元中 ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  // ── 未ログイン ────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return <LoginForm onLogin={login} error={error} />;
  }

  // ── チャット画面 ──────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* モバイル用オーバーレイ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        isLoading={sessionsLoading}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onLogout={logout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* モバイル用ヘッダー */}
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
