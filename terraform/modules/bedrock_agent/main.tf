data "aws_caller_identity" "current" {}

# ─── S3 Bucket for OpenAPI Schemas ────────────────────────────────────────────

resource "aws_s3_bucket" "schemas" {
  bucket = "bedrock-agent-schemas-${data.aws_caller_identity.current.account_id}-use1"
}

# Block all public access — schemas are accessed by Bedrock via IAM, not public URLs
resource "aws_s3_bucket_public_access_block" "schemas" {
  bucket = aws_s3_bucket.schemas.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# SSE-S3 (AES-256) encryption — no KMS key management needed for this use case
resource "aws_s3_bucket_server_side_encryption_configuration" "schemas" {
  bucket = aws_s3_bucket.schemas.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Upload OpenAPI schema; etag triggers re-upload when the local file changes
resource "aws_s3_object" "weather_schema" {
  bucket = aws_s3_bucket.schemas.id
  key    = "weather-openapi.yaml"
  source = var.schema_src_path
  etag   = filemd5(var.schema_src_path)

  depends_on = [
    aws_s3_bucket_public_access_block.schemas,
    aws_s3_bucket_server_side_encryption_configuration.schemas,
  ]
}

# ─── IAM Role for Bedrock Agent ───────────────────────────────────────────────

resource "aws_iam_role" "bedrock_agent" {
  name_prefix = "${var.project_name}-bedrock-agent-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "bedrock.amazonaws.com" }
      Action    = "sts:AssumeRole"
      # Prevent confused-deputy attacks: restrict to this account
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = data.aws_caller_identity.current.account_id
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "bedrock_agent" {
  name = "bedrock-agent-policy"
  role = aws_iam_role.bedrock_agent.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "InvokeLambda"
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = var.lambda_function_arn
      },
      {
        Sid    = "InvokeFoundationModel"
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ]
        Resource = "*"
      },
      {
        Sid    = "ReadOpenAPISchemaFromS3"
        Effect = "Allow"
        Action = ["s3:GetObject"]
        Resource = [
          "${aws_s3_bucket.schemas.arn}/*"
        ]
      }
    ]
  })
}

# ─── Bedrock Agent ────────────────────────────────────────────────────────────

resource "aws_bedrockagent_agent" "main" {
  agent_name              = "life-assistant-agent"
  agent_resource_role_arn = aws_iam_role.bedrock_agent.arn
  foundation_model        = var.foundation_model_id
  instruction             = file(var.agent_instructions_path)

  # Prepare the agent on creation so the DRAFT version is immediately usable.
  # A second prepare via null_resource runs after the action group is attached.
  prepare_agent = true

  idle_session_ttl_in_seconds = 600
}

# ─── Weather Action Group ─────────────────────────────────────────────────────

resource "aws_bedrockagent_agent_action_group" "weather" {
  agent_id          = aws_bedrockagent_agent.main.agent_id
  agent_version     = "DRAFT"
  action_group_name = "weather"

  # Prevents errors when the agent is being updated while in use
  skip_resource_in_use_check = true

  action_group_executor {
    lambda = var.lambda_function_arn
  }

  api_schema {
    s3 {
      s3_bucket_name = aws_s3_bucket.schemas.bucket
      s3_object_key  = aws_s3_object.weather_schema.key
    }
  }
}

# ─── Re-prepare Agent After Action Group Attachment ───────────────────────────
#
# aws_bedrockagent_agent_action_group does not trigger an automatic agent prepare.
# Without this second prepare, the DRAFT version will not include the action group,
# and the alias will point to an agent that cannot call the weather Lambda.

resource "null_resource" "prepare_agent_after_action_group" {
  triggers = {
    agent_id        = aws_bedrockagent_agent.main.agent_id
    action_group_id = aws_bedrockagent_agent_action_group.weather.id
  }

  provisioner "local-exec" {
    command = "aws bedrock-agent prepare-agent --agent-id ${aws_bedrockagent_agent.main.agent_id} --region ${var.aws_region}"
  }

  depends_on = [aws_bedrockagent_agent_action_group.weather]
}

# ─── Wait for Async Prepare to Complete ───────────────────────────────────────
#
# prepare-agent is asynchronous: the API call returns immediately but the agent
# moves through PREPARING → PREPARED in the background (typically 10–30 seconds).
# Without this wait the alias creation races the prepare and fails with
# "Agent is in PREPARING state". The triggers mirror null_resource so that the
# sleep re-runs whenever a new prepare is triggered.

resource "time_sleep" "wait_agent_prepared" {
  create_duration = "60s"

  triggers = {
    agent_id        = aws_bedrockagent_agent.main.agent_id
    action_group_id = aws_bedrockagent_agent_action_group.weather.id
  }

  depends_on = [null_resource.prepare_agent_after_action_group]
}

# ─── Agent Alias (dev) ────────────────────────────────────────────────────────

# Must be created after the agent reaches PREPARED state.
# Bedrock does not allow an alias to route to "DRAFT" directly — aliases must
# point to a numbered version. When no routing_configuration is specified, AWS
# auto-creates the next numbered version from the current DRAFT on each alias
# creation. replace_triggered_by forces alias recreation (and thus a new version
# snapshot) whenever a new prepare cycle runs, keeping the alias current.
resource "aws_bedrockagent_agent_alias" "dev" {
  agent_id         = aws_bedrockagent_agent.main.agent_id
  agent_alias_name = "dev"

  lifecycle {
    replace_triggered_by = [null_resource.prepare_agent_after_action_group]
  }

  depends_on = [time_sleep.wait_agent_prepared]
}
