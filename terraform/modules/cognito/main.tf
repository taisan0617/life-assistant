# ─── Cognito User Pool ────────────────────────────────────────────────────────

resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-user-pool"

  # セルフサインアップ無効 — 管理者のみがユーザーを作成できる
  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  # パスワードポリシー: 8文字以上・大小英字+数字必須
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }

  # email を認証属性として使用
  auto_verified_attributes = ["email"]

  # email を必須スキーマ属性として定義
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  # MFA 無効（学習環境）
  mfa_configuration = "OFF"

  # アカウント回復はメールで
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = {
    Project = var.project_name
    Phase   = "4"
  }
}

# ─── Cognito App Client ────────────────────────────────────────────────────────

resource "aws_cognito_user_pool_client" "frontend" {
  name         = "${var.project_name}-frontend"
  user_pool_id = aws_cognito_user_pool.main.id

  # SPA は公開クライアント（シークレット不要）
  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",         # 本番向け: SRP フロー
    "ALLOW_REFRESH_TOKEN_AUTH",    # リフレッシュトークン
    "ALLOW_USER_PASSWORD_AUTH",    # CLI テスト用 (initiate-auth で JWT 取得)
  ]

  # ユーザー存在エラーを隠蔽してブルートフォース対策を強化
  prevent_user_existence_errors = "ENABLED"

  # トークン有効期限
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  access_token_validity  = 60 # 1時間
  id_token_validity      = 60 # 1時間
  refresh_token_validity = 30 # 30日
}
