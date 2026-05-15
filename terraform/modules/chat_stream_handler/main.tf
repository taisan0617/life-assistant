data "aws_caller_identity" "current" {}

# ─── Lambda Deployment Package ────────────────────────────────────────────────

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = var.lambda_src_path
  output_path = "${path.module}/chat_stream.zip"
}

# ─── IAM Role ─────────────────────────────────────────────────────────────────

resource "aws_iam_role" "chat_stream" {
  name_prefix = "${var.project_name}-chat-stream-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.chat_stream.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "chat_stream" {
  name = "chat-stream-policy"
  role = aws_iam_role.chat_stream.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "InvokeBedrockAgent"
        Effect   = "Allow"
        Action   = ["bedrock:InvokeAgent"]
        # Agent ARN requires account+region scope; wildcard avoids chicken-and-egg
        # when agent_id changes between phases. Scope to agent/* at minimum.
        Resource = "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:agent-alias/${var.agent_id}/${var.agent_alias_id}"
      },
      {
        Sid    = "DynamoDBConversations"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
        ]
        Resource = [
          var.dynamodb_table_arn,
          "${var.dynamodb_table_arn}/index/*",
        ]
      },
    ]
  })
}

# ─── Lambda Function ──────────────────────────────────────────────────────────

resource "aws_lambda_function" "chat_stream" {
  function_name    = "${var.project_name}-chat-stream-handler"
  role             = aws_iam_role.chat_stream.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  timeout          = 60
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      AGENT_ID              = var.agent_id
      AGENT_ALIAS_ID        = var.agent_alias_id
      DYNAMODB_TABLE        = var.dynamodb_table_name
      COGNITO_USER_POOL_ID  = var.cognito_user_pool_id
      COGNITO_APP_CLIENT_ID = var.cognito_app_client_id
      ALLOW_UNAUTHENTICATED = tostring(var.allow_unauthenticated)
      DEBUG_TRACE           = tostring(var.debug_trace)
    }
  }
}

# ─── Function URL (RESPONSE_STREAM) ──────────────────────────────────────────
#
# RESPONSE_STREAM: the runtime flushes each chunk immediately without buffering.
# Authorization is NONE for Phase 2; Phase 4 will restrict to CloudFront OAC.

resource "aws_lambda_function_url" "chat_stream" {
  function_name      = aws_lambda_function.chat_stream.function_name
  authorization_type = "NONE"
  invoke_mode        = "RESPONSE_STREAM"

  cors {
    allow_origins = ["*"]
    allow_methods = ["POST"]
    allow_headers = ["content-type", "authorization"]
    max_age       = 86400
  }
}

# Allow any principal to invoke via the Function URL.
# Phase 4: replace principal="*" with CloudFront service principal + OAC.
resource "aws_lambda_permission" "function_url_public" {
  statement_id           = "AllowPublicFunctionURL"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.chat_stream.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}
