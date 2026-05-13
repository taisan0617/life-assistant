variable "aws_region" {
  description = "AWS region (used for IAM resource ARN construction)"
  type        = string
}

variable "project_name" {
  description = "Project name prefix for resource naming"
  type        = string
}

variable "agent_id" {
  description = "Bedrock Agent ID (from bedrock_agent module output)"
  type        = string
}

variable "agent_alias_id" {
  description = "Bedrock Agent Alias ID (from bedrock_agent module output)"
  type        = string
}

variable "dynamodb_table_name" {
  description = "DynamoDB table name for conversation history"
  type        = string
}

variable "dynamodb_table_arn" {
  description = "DynamoDB table ARN (used in IAM policy)"
  type        = string
}

variable "lambda_src_path" {
  description = "Absolute path to the chat_stream Lambda source directory"
  type        = string
}

variable "debug_trace" {
  description = "Set to true to dump raw Bedrock trace events to CloudWatch Logs"
  type        = bool
  default     = false
}
