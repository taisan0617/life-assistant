output "api_endpoint" {
  description = "API Gateway invoke URL (e.g. https://{id}.execute-api.{region}.amazonaws.com/dev)"
  value       = aws_api_gateway_stage.dev.invoke_url
}

output "rest_api_id" {
  description = "REST API ID"
  value       = aws_api_gateway_rest_api.history.id
}
