output "lambda_function_arn" {
  description = "ARN of the weather Lambda function"
  value       = aws_lambda_function.weather.arn
}

output "lambda_function_name" {
  description = "Name of the weather Lambda function"
  value       = aws_lambda_function.weather.function_name
}

output "secret_arn" {
  description = "ARN of the Secrets Manager secret (openweather API key)"
  value       = aws_secretsmanager_secret.openweather.arn
}
