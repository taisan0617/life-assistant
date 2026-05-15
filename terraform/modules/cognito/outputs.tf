output "user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "Cognito User Pool ARN (used by API Gateway Cognito Authorizer)"
  value       = aws_cognito_user_pool.main.arn
}

output "app_client_id" {
  description = "Cognito App Client ID (used by frontend and Lambda JWT verifier)"
  value       = aws_cognito_user_pool_client.frontend.id
}
