# Life Assistant Bedrock Agent — Terraform

Amazon Bedrock Agents を使った生活アシスタントの Terraform 管理プロジェクトです。

---

## Phase 4-A: Cognito 認証のデプロイと動作確認

### Step 1 — aws-jwt-verify をインストール

```powershell
# ディレクトリ: terraform\lambda\chat_stream
cd terraform\lambda\chat_stream
npm install
```

### Step 2 — Terraform apply

```powershell
# ディレクトリ: terraform\envs\dev
cd ..\..\envs\dev
terraform plan -out=tfplan
terraform apply tfplan
```

apply 完了後に Cognito の情報を確認:

```powershell
$POOL_ID   = terraform output -raw cognito_user_pool_id
$CLIENT_ID = terraform output -raw cognito_app_client_id
Write-Host "User Pool ID : $POOL_ID"
Write-Host "Client ID    : $CLIENT_ID"
```

### Step 3 — ユーザーを作成（管理者のみ作成可）

```powershell
# ディレクトリ: terraform\envs\dev
$EMAIL = "your-email@example.com"   # 自分のメールアドレスに変更

# ① ユーザーを作成（仮パスワードを設定）
aws cognito-idp admin-create-user `
  --user-pool-id $POOL_ID `
  --username $EMAIL `
  --user-attributes Name=email,Value=$EMAIL Name=email_verified,Value=true `
  --message-action SUPPRESS `
  --temporary-password "Temp1234!" `
  --region us-east-1

# ② 本番パスワードに変更（FORCE_CHANGE_PASSWORD 状態を解除）
aws cognito-idp admin-set-user-password `
  --user-pool-id $POOL_ID `
  --username $EMAIL `
  --password "MyPass1234!" `
  --permanent `
  --region us-east-1
```

> パスワードポリシー: 8文字以上・大文字・小文字・数字を含むこと

### Step 4 — JWT を取得してテスト

```powershell
# IdToken を取得（ALLOW_USER_PASSWORD_AUTH フロー）
$AUTH = aws cognito-idp initiate-auth `
  --auth-flow USER_PASSWORD_AUTH `
  --client-id $CLIENT_ID `
  --auth-parameters USERNAME=$EMAIL,PASSWORD="MyPass1234!" `
  --region us-east-1 | ConvertFrom-Json

$ID_TOKEN = $AUTH.AuthenticationResult.IdToken
Write-Host "IdToken 取得成功（先頭50文字）: $($ID_TOKEN.Substring(0,50))..."
```

#### ストリーミングチャットのテスト

```powershell
$URL = terraform output -raw chat_stream_url

curl -N -X POST $URL `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $ID_TOKEN" `
  -d '{"message":"東京の天気を教えて"}'
```

#### 履歴 API のテスト

```powershell
$API = terraform output -raw history_api_endpoint

curl -H "Authorization: Bearer $ID_TOKEN" "$API/sessions"
```

#### 認証なしのリクエスト（401 が返ることを確認）

```powershell
# chat-stream: 401 + {"type":"error","message":"Unauthorized: ..."}
curl -N -X POST $URL -H "Content-Type: application/json" -d '{"message":"test"}'

# history API: 401 Unauthorized
curl "$API/sessions"
```

---

## Phase 4-C: CloudFront + S3 静的ホスティング

### Step 1 — Terraform apply（cloudfront モジュールを追加）

```powershell
# ディレクトリ: terraform\envs\dev
terraform init   # 新モジュール追加後は必ず init
terraform plan -out=tfplan
terraform apply tfplan
```

apply 完了後に出力を確認:

```powershell
terraform output cloudfront_domain          # → xxx.cloudfront.net
terraform output cloudfront_distribution_id # → E1XXXXXXXXX
terraform output frontend_bucket_name       # → life-assistant-frontend-XXXXXXXXXXXX
```

### Step 2 — .env.production を編集

`frontend\.env.production` を開き、Cognito の値を埋める:

```
VITE_COGNITO_USER_POOL_ID  = <terraform output -raw cognito_user_pool_id>
VITE_COGNITO_APP_CLIENT_ID = <terraform output -raw cognito_app_client_id>
```

### Step 3 — ビルドして S3 へデプロイ

```powershell
# ディレクトリ: frontend
cd C:\life-assistant\frontend
npm run build

# S3 へアップロード
$BUCKET = terraform -chdir=..\terraform\envs\dev output -raw frontend_bucket_name
aws s3 sync dist/ "s3://$BUCKET/" --delete

# CloudFront キャッシュを無効化
$DIST_ID = terraform -chdir=..\terraform\envs\dev output -raw cloudfront_distribution_id
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

### Step 4 — 動作確認

```powershell
$DOMAIN = terraform -chdir=..\terraform\envs\dev output -raw cloudfront_domain
# ブラウザで https://$DOMAIN を開く
```

> **注意:** CloudFront のデプロイには数分かかります。キャッシュ無効化完了後にアクセスしてください。

---

## クイックスタート（初回デプロイ）

> 各ブロックの先頭コメントが **実行するディレクトリ** を示しています。

### Step 1 — Node.js 依存パッケージをインストール

```powershell
# ディレクトリ: terraform\lambda\chat_stream
cd terraform\lambda\chat_stream
npm install
```

### Step 2 — Terraform を初期化してデプロイ

```powershell
# ディレクトリ: terraform\envs\dev
cd ..\..\envs\dev
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

### Step 3 — OpenWeatherMap API キーを登録

```powershell
# ディレクトリ: どこでも可
aws secretsmanager put-secret-value `
  --secret-id bedrock-agent/openweather `
  --secret-string '{"api_key": "<YOUR_OPENWEATHERMAP_API_KEY>"}' `
  --region us-east-1
```

### Step 4 — エンドポイントを確認して動作テスト

```powershell
# ディレクトリ: terraform\envs\dev
$URL = terraform output -raw chat_stream_url
$API = terraform output -raw history_api_endpoint

# ストリーミングチャット（新規セッション）
curl -N -X POST $URL `
  -H "Content-Type: application/json" `
  -d '{"message":"東京の天気を教えて"}'

# 会話履歴一覧
curl "$API/sessions"
```

---

## コード変更後の再デプロイ

Lambda コードや Terraform を変更した場合:

```powershell
# ディレクトリ: terraform\envs\dev
terraform plan -out=tfplan
terraform apply tfplan
```

> `chat_stream/index.mjs` を変更した場合は `npm install` の再実行は不要です（依存パッケージを追加した場合のみ必要）。

---

## terraform destroy（全リソース削除）

```powershell
# ディレクトリ: terraform\envs\dev
terraform destroy
```

> **注意:** S3 バケットにオブジェクトが残っている場合は destroy が失敗します。事前に空にしてください:
> ```powershell
> $ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
> aws s3 rm "s3://bedrock-agent-schemas-${ACCOUNT_ID}-use1" --recursive
> aws s3 rm "s3://life-assistant-frontend-${ACCOUNT_ID}" --recursive
> ```

---

## 前提条件

| ツール | バージョン |
|--------|-----------|
| Terraform | >= 1.5 |
| AWS CLI | >= 2.x |
| Node.js | >= 20.x |

必要な IAM 権限: `bedrock:*`, `lambda:*`, `iam:*`, `s3:*`, `secretsmanager:*`, `dynamodb:*`, `apigateway:*`

---

## アーキテクチャ

### Phase 1

```
ユーザー
  └─► Bedrock Agent (life-assistant-agent)
          └─► Weather Action Group
                  └─► Lambda (bedrock-agent-weather-action)
                              └─► OpenWeatherMap API
                                    ↑
                              Secrets Manager
                          (bedrock-agent/openweather)
```

### Phase 2

```
クライアント (React UI / curl)
  │
  ├─► Lambda Function URL (RESPONSE_STREAM)        ← ストリーミング応答
  │       chat-stream-handler  [Node.js]
  │           └─► Bedrock Agent → Weather Lambda
  │           └─► DynamoDB (会話保存)
  │
  └─► API Gateway REST API                          ← 履歴系 REST
          history-handler  [Python]
              └─► DynamoDB (会話一覧・メッセージ取得)
```

### Phase 4-C

```
ブラウザ
  └─► CloudFront Distribution (xxx.cloudfront.net)
        ├─► /chat          → Lambda Function URL (RESPONSE_STREAM, compress=false)
        ├─► /api/*         → API Gateway /dev/*  (CloudFront Function で prefix 除去)
        └─► /*             → S3 バケット (静的ファイル, SPA fallback)
```

---

## ディレクトリ構成

```
terraform/
├── envs/dev/                   # デプロイ実行ディレクトリ
│   ├── providers.tf
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── terraform.tfvars
├── modules/
│   ├── weather_lambda/         # Phase 1: 天気 Lambda + IAM
│   ├── bedrock_agent/          # Phase 1: Bedrock Agent + Action Group
│   ├── dynamodb/               # Phase 2: 会話履歴テーブル
│   ├── chat_stream_handler/    # Phase 2: ストリーミング Lambda + Function URL
│   ├── history_handler/        # Phase 2: 履歴 Lambda
│   ├── history_api/            # Phase 2: API Gateway REST API
│   ├── cognito/                # Phase 4-A: Cognito User Pool + App Client
│   └── cloudfront/             # Phase 4-C: CloudFront + S3 静的ホスティング
├── lambda/
│   ├── weather_action/         # lambda_function.py
│   ├── chat_stream/            # index.mjs + package.json
│   └── history/                # lambda_function.py
├── schemas/
│   └── weather-openapi.yaml
└── agent_instructions.txt
```

---

## DynamoDB スキーマ

**Session レコード**
```
PK = USER#<userId>      SK = SESSION#<uuid>
属性: userId, sessionId, title, createdAt, updatedAt, lastMessage
GSI: userId (PK) / updatedAt (SK) → userId-updatedAt-index
```

**Message レコード**
```
PK = SESSION#<uuid>     SK = MSG#<isoTimestamp>#<uuid>
属性: sessionId, messageId, role, content, toolCalls, createdAt
```

---

## API リファレンス

### ストリーミングチャット

**エンドポイント:** `terraform output -raw chat_stream_url`

```powershell
# 新規セッション
curl -N -X POST $URL `
  -H "Content-Type: application/json" `
  -d '{"message":"横浜の天気を教えて"}'

# 既存セッション継続
curl -N -X POST $URL `
  -H "Content-Type: application/json" `
  -d '{"message":"大阪は？","sessionId":"<session-id>"}'
```

**レスポンス形式 (NDJSON):**
```
{"type":"chunk","text":"横浜の現在の天気を"}
{"type":"chunk","text":"お伝えします。"}
{"type":"trace","actionGroup":"weather","function":"/getCurrentWeather","parameters":{"city":"Yokohama"}}
{"type":"done","messageId":"<uuid>","sessionId":"<uuid>"}
```

### 履歴 REST API

**エンドポイント:** `terraform output -raw history_api_endpoint`

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/sessions` | セッション一覧（新しい順） |
| GET | `/sessions/<id>` | セッション内メッセージ一覧 |
| POST | `/sessions` | セッション新規作成 |

```powershell
curl "$API/sessions"
curl "$API/sessions/<session-id>"
curl -X POST "$API/sessions" -H "Content-Type: application/json" -d '{"title":"天気チェック"}'
```

---

## よくあるエラーと対処

| エラー | 原因 | 対処 |
|--------|------|------|
| `PREPARING` state on alias creation | prepare-agent が完了する前に alias を作成しようとした | `terraform apply` を再実行 |
| `ConflictException: secret already exists` | 同名シークレットが残っている | `terraform import` で取り込む |
| `BucketAlreadyOwnedByYou` | S3 バケットが既に存在する | 手動削除後に再実行 |
| Lambda タイムアウト | OpenWeatherMap API の応答遅延 | Lambda タイムアウトを 60 秒に変更 |
| `AccessDeniedException` on bedrock:InvokeModel | Bedrock モデルアクセス未設定 | AWS コンソールで Claude モデルへのアクセスをリクエスト |

---

## 既存シークレットを Terraform にインポートする場合

```powershell
# ディレクトリ: terraform\envs\dev
$SECRET_ARN = aws secretsmanager describe-secret `
  --secret-id bedrock-agent/openweather `
  --query ARN --output text --region us-east-1

terraform import module.weather_lambda.aws_secretsmanager_secret.openweather $SECRET_ARN
```
