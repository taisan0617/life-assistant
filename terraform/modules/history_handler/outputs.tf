output "function_arn" {
  description = "ARN of the history Lambda function"
  value       = aws_lambda_function.history.arn
}

output "function_name" {
  description = "Name of the history Lambda function"
  value       = aws_lambda_function.history.function_name
}

output "invoke_arn" {
  description = "Invoke ARN used by API Gateway integration URI"
  value       = aws_lambda_function.history.invoke_arn
}
