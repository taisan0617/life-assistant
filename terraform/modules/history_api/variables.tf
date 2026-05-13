variable "project_name" {
  description = "Project name (for resource descriptions)"
  type        = string
}

variable "history_lambda_invoke_arn" {
  description = "Invoke ARN of the history Lambda (used as API Gateway integration URI)"
  type        = string
}

variable "history_lambda_name" {
  description = "Name of the history Lambda function (used for resource-based policy)"
  type        = string
}
