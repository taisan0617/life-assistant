# ─── Phase 1 Outputs ──────────────────────────────────────────────────────────

output "agent_id" {
  description = "Bedrock Agent ID"
  value       = module.bedrock_agent.agent_id
}

output "agent_alias_id" {
  description = "Bedrock Agent Alias ID (dev)"
  value       = module.bedrock_agent.agent_alias_id
}

output "lambda_function_arn" {
  description = "Weather Lambda function ARN"
  value       = module.weather_lambda.lambda_function_arn
}

output "s3_bucket_name" {
  description = "S3 bucket name for OpenAPI schemas"
  value       = module.bedrock_agent.s3_bucket_name
}

# ─── Phase 2 Outputs ──────────────────────────────────────────────────────────

output "chat_stream_url" {
  description = "Lambda Function URL for streaming chat (POST, RESPONSE_STREAM)"
  value       = module.chat_stream_handler.function_url
}

output "history_api_endpoint" {
  description = "API Gateway base URL for conversation history REST API"
  value       = module.history_api.api_endpoint
}

output "dynamodb_table_name" {
  description = "DynamoDB table name for conversation history"
  value       = module.dynamodb.table_name
}

output "dynamodb_table_arn" {
  description = "DynamoDB table ARN"
  value       = module.dynamodb.table_arn
}
