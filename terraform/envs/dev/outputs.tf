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
