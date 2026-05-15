import { useState, FormEvent } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
  error: string | null;
}

/**
 * ログインフォーム。画面中央に配置したカード形式。
 * SRP 認証中はボタンをスピナーで無効化する。
 */
export function LoginForm({ onLogin, error }: Props) {
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setIsLoading(true);
    try {
      await onLogin(email.trim(), password);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        {/* タイトル */}
        <div className="text-center mb-8">
          <p className="text-3xl mb-2">🌤️</p>
          <h1 className="text-xl font-bold text-gray-800">Life Assistant</h1>
          <p className="text-sm text-gray-500 mt-1">アカウントにログインしてください</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* メールアドレス */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={isLoading}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:bg-gray-50 disabled:text-gray-400 transition-shadow"
              placeholder="example@mail.com"
            />
          </div>

          {/* パスワード */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={isLoading}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:bg-gray-50 disabled:text-gray-400 transition-shadow"
              placeholder="••••••••"
            />
          </div>

          {/* エラーメッセージ */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* ログインボタン */}
          <button
            type="submit"
            disabled={isLoading || !email.trim() || !password}
            className="w-full bg-blue-500 text-white rounded-lg py-2.5 text-sm font-medium
                       hover:bg-blue-600 disabled:bg-gray-200 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2 transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                ログイン中…
              </>
            ) : (
              "ログイン"
            )}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          アカウントは管理者が作成します
        </p>
      </div>
    </div>
  );
}
