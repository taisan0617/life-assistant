variable "project_name" {
  description = "Project name prefix for resource naming"
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
  description = "Absolute path to the history Lambda source directory"
  type        = string
}
