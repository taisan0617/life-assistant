data "aws_caller_identity" "current" {}

# ─── Lambda Deployment Package ────────────────────────────────────────────────

# Zip the Lambda source directory; output_path lives in the module directory
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = var.lambda_src_path
  output_path = "${path.module}/weather_action.zip"
}

# ─── IAM Role for Lambda ───────────────────────────────────────────────────────

resource "aws_iam_role" "lambda" {
  # name_prefix avoids collisions and enables parallel environment deployments
  name_prefix = "${var.project_name}-weather-lambda-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Least-privilege: only the specific secret this function needs
resource "aws_iam_role_policy" "lambda_secrets_access" {
  name = "read-openweather-secret"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      # Trailing wildcard covers the random suffix AWS appends to secret ARNs
      Resource = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${var.secret_name}*"
    }]
  })
}

# ─── Lambda Function ──────────────────────────────────────────────────────────

resource "aws_lambda_function" "weather" {
  function_name    = "bedrock-agent-weather-action"
  role             = aws_iam_role.lambda.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  architectures    = ["arm64"]
  timeout          = 30
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      SECRET_NAME = var.secret_name
    }
  }
}

# ─── Resource-based Policy ────────────────────────────────────────────────────

# Allow any Bedrock Agent in this account/region to invoke this function.
# Scoped to agent/* — tighter than bedrock.amazonaws.com alone.
resource "aws_lambda_permission" "allow_bedrock_agent" {
  statement_id  = "AllowBedrockAgentInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.weather.function_name
  principal     = "bedrock.amazonaws.com"
  source_arn    = "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:agent/*"
}

# ─── Secrets Manager (shell only) ─────────────────────────────────────────────

# Creates the secret container; the actual API key is injected manually via CLI.
# recovery_window_in_days = 0 allows immediate deletion on terraform destroy.
resource "aws_secretsmanager_secret" "openweather" {
  name                    = var.secret_name
  recovery_window_in_days = 0
}
