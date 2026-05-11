output "agent_id" {
  description = "Bedrock Agent ID"
  value       = aws_bedrockagent_agent.main.agent_id
}

output "agent_alias_id" {
  description = "Bedrock Agent Alias ID (dev)"
  value       = aws_bedrockagent_agent_alias.dev.agent_alias_id
}

output "s3_bucket_name" {
  description = "S3 bucket name for OpenAPI schemas"
  value       = aws_s3_bucket.schemas.bucket
}
