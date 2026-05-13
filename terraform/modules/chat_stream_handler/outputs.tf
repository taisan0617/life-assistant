output "function_url" {
  description = "Lambda Function URL for streaming chat (RESPONSE_STREAM)"
  value       = aws_lambda_function_url.chat_stream.function_url
}

output "function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.chat_stream.arn
}
