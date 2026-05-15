variable "project_name" {
  description = "Project name prefix for resource naming"
  type        = string
}

variable "chat_stream_function_url" {
  description = "Lambda Function URL for streaming chat (full URL, e.g. https://xxx.lambda-url.us-east-1.on.aws/)"
  type        = string
}

variable "history_api_endpoint" {
  description = "API Gateway invoke URL including stage (e.g. https://xxx.execute-api.us-east-1.amazonaws.com/dev)"
  type        = string
}
