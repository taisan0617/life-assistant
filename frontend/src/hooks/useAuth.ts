import { useState, useEffect } from "react";
import {
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { userPool } from "../lib/cognito";
import type { AuthUser } from "../lib/types";

/**
 * Cognito 認証状態を管理するカスタムフック。
 *
 * 初期化時:
 *   getCurrentUser() → getSession() で localStorage のセッションを復元する。
 *   有効な refreshToken があれば idToken を自動更新してくれる。
 *
 * login:
 *   SRP フロー（authenticateUser）で認証し、idToken をメモリに保持。
 *
 * logout:
 *   signOut() で localStorage のセッションをクリアし、state をリセット。
 */
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading,       setIsLoading]       = useState(true); // セッション復元中
  const [user,            setUser]            = useState<AuthUser | null>(null);
  const [idToken,         setIdToken]         = useState<string | null>(null);
  const [error,           setError]           = useState<string | null>(null);

  // ── 起動時セッション復元 ─────────────────────────────────────────────────
  useEffect(() => {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      setIsLoading(false);
      return;
    }

    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) {
        // refreshToken 期限切れなどで復元できない場合はログイン画面へ
        setIsLoading(false);
        return;
      }
      applySession(session);
      setIsLoading(false);
    });
  }, []);

  // ── セッション情報を state に反映する共通処理 ─────────────────────────────
  function applySession(session: CognitoUserSession) {
    const token   = session.getIdToken().getJwtToken();
    const payload = session.getIdToken().decodePayload() as Record<string, string>;
    setIdToken(token);
    setUser({ email: payload["email"] ?? "", sub: payload["sub"] ?? "" });
    setIsAuthenticated(true);
  }

  // ── ログイン（SRP フロー） ────────────────────────────────────────────────
  const login = async (email: string, password: string): Promise<void> => {
    setError(null);

    const authDetails  = new AuthenticationDetails({ Username: email, Password: password });
    const cognitoUser  = new CognitoUser({ Username: email, Pool: userPool });

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authDetails, {
        onSuccess(session: CognitoUserSession) {
          applySession(session);
          resolve();
        },
        onFailure(err: { code?: string; message: string }) {
          setError(toJapaneseError(err));
          reject(err);
        },
        newPasswordRequired() {
          // admin-set-user-password --permanent 済みなら発生しないが念のため
          const msg = "パスワード変更が必要です。管理者に連絡してください。";
          setError(msg);
          reject(new Error(msg));
        },
      });
    });
  };

  // ── ログアウト ───────────────────────────────────────────────────────────
  const logout = () => {
    const cognitoUser = userPool.getCurrentUser();
    cognitoUser?.signOut();
    setIdToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  };

  return { isAuthenticated, isLoading, user, idToken, login, logout, error };
}

// ── エラーコードを日本語メッセージに変換 ─────────────────────────────────────
function toJapaneseError(err: { code?: string; message: string }): string {
  switch (err.code) {
    case "NotAuthorizedException":
      return "メールアドレスまたはパスワードが正しくありません。";
    case "UserNotFoundException":
      return "ユーザーが見つかりません。";
    case "PasswordResetRequiredException":
      return "パスワードのリセットが必要です。管理者に連絡してください。";
    case "UserNotConfirmedException":
      return "メールアドレスの確認が完了していません。";
    case "TooManyRequestsException":
      return "試行回数が多すぎます。しばらく待ってから再度お試しください。";
    default:
      return err.message || "ログインに失敗しました。";
  }
}
