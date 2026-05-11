# Life Assistant Bedrock Agent — Terraform (Phase 1)

Amazon Bedrock Agents を使った生活アシスタントの Phase 1 インフラを Terraform で管理するプロジェクトです。

## アーキテクチャ

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

## ディレクトリ構成

```
terraform/
├── envs/dev/               # デプロイ実行ディレクトリ
│   ├── providers.tf        # AWS プロバイダー設定
│   ├── main.tf             # モジュール呼び出し
│   ├── variables.tf
│   ├── outputs.tf
│   └── terraform.tfvars    # 環境固有の値
├── modules/
│   ├── weather_lambda/     # Lambda + IAM + Secrets Manager
│   └── bedrock_agent/      # S3 + Bedrock Agent + Action Group + Alias
├── lambda/weather_action/
│   └── lambda_function.py  # OpenWeatherMap を呼び出すハンドラー
├── schemas/
│   └── weather-openapi.yaml
└── agent_instructions.txt
```

---

## 前提条件

| ツール | バージョン |
|--------|-----------|
| Terraform | >= 1.5 |
| AWS CLI | >= 2.x |
| Python | 3.x（boto3動作確認用） |

### AWS CLI 設定

```powershell
aws configure
# プロファイルを使う場合
aws configure --profile my-profile
```

必要な IAM 権限:
- `bedrock:*`, `lambda:*`, `iam:*`, `s3:*`, `secretsmanager:*`

---

## Phase 1 手動作成リソースの削除手順

Terraform 管理に移行する前に、手動作成済みのリソースを削除してください。

```powershell
# Agent ID / Alias ID を確認
aws bedrock-agent list-agents --region us-east-1
aws bedrock-agent list-agent-aliases --agent-id <AGENT_ID> --region us-east-1

# 1. Agent Alias を削除
aws bedrock-agent delete-agent-alias `
  --agent-id <AGENT_ID> `
  --agent-alias-id <ALIAS_ID> `
  --region us-east-1

# 2. Bedrock Agent を削除
aws bedrock-agent delete-agent `
  --agent-id <AGENT_ID> `
  --skip-resource-in-use-check `
  --region us-east-1

# 3. Lambda 関数を削除
aws lambda delete-function `
  --function-name bedrock-agent-weather-action `
  --region us-east-1

# 4. Secrets Manager シークレットを即時削除
aws secretsmanager delete-secret `
  --secret-id bedrock-agent/openweather `
  --force-delete-without-recovery `
  --region us-east-1

# 5. S3 バケットを削除（オブジェクトを先に削除してからバケットを削除）
$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
aws s3 rm "s3://bedrock-agent-schemas-${ACCOUNT_ID}-use1" --recursive
aws s3 rb "s3://bedrock-agent-schemas-${ACCOUNT_ID}-use1" --region us-east-1
```

### 既存シークレットを削除せず Terraform にインポートする場合

```powershell
# シークレット ARN を取得
$SECRET_ARN = aws secretsmanager describe-secret `
  --secret-id bedrock-agent/openweather `
  --query ARN --output text --region us-east-1

# Terraform へインポート（envs/dev/ で実行）
cd envs\dev
terraform import module.weather_lambda.aws_secretsmanager_secret.openweather $SECRET_ARN
```

---

## デプロイ手順

### 1. terraform init

```powershell
cd <このリポジトリのルート>\terraform\envs\dev
terraform init
```

### 2. terraform plan（差分確認）

```powershell
terraform plan -out=tfplan
```

### 3. terraform apply

```powershell
terraform apply tfplan
```

完了後の出力例:

```
Outputs:
  agent_id            = "ABCDEFGHIJ"
  agent_alias_id      = "KLMNOPQRST"
  lambda_function_arn = "arn:aws:lambda:us-east-1:123456789012:function:bedrock-agent-weather-action"
  s3_bucket_name      = "bedrock-agent-schemas-123456789012-use1"
```

---

## OpenWeatherMap APIキーの登録

`terraform apply` 完了後、Secrets Manager にAPIキーを登録します。

```powershell
aws secretsmanager put-secret-value `
  --secret-id bedrock-agent/openweather `
  --secret-string '{"api_key": "<YOUR_OPENWEATHERMAP_API_KEY>"}' `
  --region us-east-1
```

> APIキーは [OpenWeatherMap](https://openweathermap.org/api) で取得できます（無料プランあり）。

---

## 動作確認（boto3スクリプト）

以下のスクリプトを `test_agent.py` として保存して実行してください。

```python
import boto3

AGENT_ID       = "<YOUR_AGENT_ID>"       # terraform output agent_id
AGENT_ALIAS_ID = "<YOUR_AGENT_ALIAS_ID>" # terraform output agent_alias_id
REGION         = "us-east-1"

client = boto3.client("bedrock-agent-runtime", region_name=REGION)

response = client.invoke_agent(
    agentId=AGENT_ID,
    agentAliasId=AGENT_ALIAS_ID,
    sessionId="test-session-001",
    inputText="東京の今の天気を教えてください",
)

full_response = ""
for event in response["completion"]:
    if "chunk" in event:
        full_response += event["chunk"]["bytes"].decode("utf-8")

print(full_response)
```

```powershell
pip install boto3
python test_agent.py
```

期待するレスポンス例:
```
東京の現在の天気をお伝えします。気温は約22度（体感温度：約21度）で、天気は「晴れ」です。
湿度は55%、風速は約3.5m/sとなっています。
```

---

## terraform destroy

```powershell
cd envs\dev
terraform destroy
```

> **注意事項**
> - `aws_secretsmanager_secret` は `recovery_window_in_days = 0` のため即時削除されます。
> - S3 バケットにオブジェクトが残っている場合は destroy が失敗します。事前に空にしてください:
>   ```powershell
>   $ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
>   aws s3 rm "s3://bedrock-agent-schemas-${ACCOUNT_ID}-use1" --recursive
>   ```

---

## よくあるエラーと対処

| エラー | 原因 | 対処 |
|--------|------|------|
| `PREPARING` state on alias creation | prepare-agent が完了する前に alias を作成しようとした | `terraform apply` を再実行 |
| `ConflictException: secret already exists` | 同名シークレットが残っている | Import 手順を参照 |
| `BucketAlreadyOwnedByYou` | S3 バケットが既に存在する | 手動削除後に再実行 |
| Lambda タイムアウト | OpenWeatherMap API の応答遅延 | Lambda タイムアウトを 60 秒に変更 |
| `AccessDeniedException` on bedrock:InvokeModel | Bedrock エンドポイントへのアクセス未申請 | AWS コンソールで Claude モデルへのアクセスをリクエスト |
