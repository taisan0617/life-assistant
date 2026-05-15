# Life Assistant Frontend

Bedrock Agent + Lambda ストリーミングと連携する React チャット UI です。
Phase 4-B から Cognito 認証が追加されています。

## 起動手順

```powershell
# 1. 依存パッケージをインストール
cd C:\life-assistant\frontend
npm install

# 2. 環境変数ファイルを作成
Copy-Item .env.example .env.local
```

`.env.local` を開いて以下の値を埋める:

```
# terraform\envs\dev で取得
VITE_CHAT_STREAM_URL=<terraform output -raw chat_stream_url>
VITE_HISTORY_API_URL=<terraform output -raw history_api_endpoint>

# Cognito（terraform\envs\dev で取得）
VITE_COGNITO_USER_POOL_ID=<terraform output -raw cognito_user_pool_id>
VITE_COGNITO_APP_CLIENT_ID=<terraform output -raw cognito_app_client_id>
VITE_COGNITO_REGION=us-east-1
```

```powershell
# 3. 開発サーバーを起動
npm run dev
```

ブラウザで http://localhost:5173 を開く。

---

## Phase 4-B: Cognito 認証の動作確認

### 前提: ユーザーを作成済みであること

Terraform README の「Phase 4-A」手順に従い、AWS CLI でユーザーを作成しておく。

### 確認手順

1. http://localhost:5173 を開く → ログイン画面が表示される
2. メールアドレスとパスワードを入力してログイン
3. チャット画面に遷移する
4. 「東京の天気を教えて」などを送信 → JWT が自動付与されてレスポンスが返る
5. ページをリロード → ログイン画面に戻らず、そのままチャット画面が表示される（セッション維持）
6. サイドバー下部の「ログアウト」ボタンをクリック → ログイン画面に戻る

---

## ビルド

```powershell
npm run build
# dist/ 以下に静的ファイルが生成される
```

---

## Phase 4-C: CloudFront + S3 静的ホスティング

### 前提

`terraform apply` 済みで、以下の出力が取得できること:

```powershell
cd C:\life-assistant\terraform\envs\dev
terraform output cloudfront_domain          # → xxx.cloudfront.net
terraform output cloudfront_distribution_id # → E1XXXXXXXXX
terraform output frontend_bucket_name       # → life-assistant-frontend-XXXXXXXXXXXX
terraform output cognito_user_pool_id
terraform output cognito_app_client_id
```

### デプロイ手順

```powershell
# 1. .env.production の Cognito 値を埋める
#    VITE_COGNITO_USER_POOL_ID  = terraform output -raw cognito_user_pool_id
#    VITE_COGNITO_APP_CLIENT_ID = terraform output -raw cognito_app_client_id

# 2. プロダクションビルド（Vite が .env.production を使用）
cd C:\life-assistant\frontend
npm run build

# 3. S3 にアップロード
$BUCKET = (Set-Location C:\life-assistant\terraform\envs\dev; terraform output -raw frontend_bucket_name)
aws s3 sync dist/ "s3://$BUCKET/" --delete

# 4. CloudFront キャッシュ無効化（コード変更のたびに実行）
$DIST_ID = (Set-Location C:\life-assistant\terraform\envs\dev; terraform output -raw cloudfront_distribution_id)
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"

# 5. アクセス確認
$DOMAIN = (Set-Location C:\life-assistant\terraform\envs\dev; terraform output -raw cloudfront_domain)
Write-Host "https://$DOMAIN"
```

### ルーティング構成

| パス | 転送先 |
|------|--------|
| `/chat` | Lambda Function URL（ストリーミング、compress=false） |
| `/api/*` | API Gateway `/dev/*`（CloudFront Function で `/api` prefix を除去） |
| `/*` | S3 バケット（静的ファイル、SPA fallback あり） |
