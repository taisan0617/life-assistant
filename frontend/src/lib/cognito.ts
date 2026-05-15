import { CognitoUserPool } from "amazon-cognito-identity-js";

/**
 * アプリ全体で共有する CognitoUserPool インスタンス。
 * モジュールスコープで1度だけ生成することで、複数のフックから参照できる。
 */
export const userPool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string,
  ClientId:   import.meta.env.VITE_COGNITO_APP_CLIENT_ID as string,
});
