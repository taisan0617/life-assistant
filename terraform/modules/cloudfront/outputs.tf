output "distribution_domain" {
  description = "CloudFront distribution domain name (e.g. xxx.cloudfront.net)"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "distribution_id" {
  description = "CloudFront distribution ID (used for cache invalidation)"
  value       = aws_cloudfront_distribution.main.id
}

output "frontend_bucket_name" {
  description = "S3 bucket name for deploying frontend static files"
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.frontend.arn
}
