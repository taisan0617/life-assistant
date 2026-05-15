data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ── S3 bucket for frontend static files ──────────────────────────────────────

resource "aws_s3_bucket" "frontend" {
  bucket = "${var.project_name}-frontend-${data.aws_caller_identity.current.account_id}"

  tags = {
    Project = var.project_name
    Phase   = "4-C"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── Origin Access Control (OAC) ───────────────────────────────────────────────

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project_name}-frontend-oac"
  description                       = "OAC for frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ── Bucket policy allowing CloudFront OAC ─────────────────────────────────────

data "aws_iam_policy_document" "frontend_bucket" {
  statement {
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.main.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend_bucket.json

  depends_on = [aws_s3_bucket_public_access_block.frontend]
}

# ── Extract domains from URL inputs ──────────────────────────────────────────

locals {
  # https://xxx.lambda-url.us-east-1.on.aws/ → xxx.lambda-url.us-east-1.on.aws
  chat_stream_domain = trimprefix(trimsuffix(var.chat_stream_function_url, "/"), "https://")

  # https://xxx.execute-api.us-east-1.amazonaws.com/dev → ["xxx...", "dev"]
  history_api_parts  = split("/", trimprefix(var.history_api_endpoint, "https://"))
  history_api_domain = local.history_api_parts[0]

  # /dev
  history_api_stage_path = "/${join("/", slice(local.history_api_parts, 1, length(local.history_api_parts)))}"
}

# ── CloudFront Function: strip /api prefix before API Gateway ─────────────────

resource "aws_cloudfront_function" "api_rewrite" {
  name    = "${var.project_name}-api-rewrite"
  runtime = "cloudfront-js-1.0"
  comment = "Strip /api prefix so CloudFront origin_path prepends the stage correctly"
  publish = true

  code = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri;
      if (uri === '/api' || uri.startsWith('/api/')) {
        request.uri = uri.slice(4) || '/';
      }
      return request;
    }
  EOT
}

# ── CloudFront distribution ───────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_All"
  comment             = "${var.project_name} frontend distribution"

  # Origin 1: S3 static files
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # Origin 2: Lambda Function URL (streaming chat)
  origin {
    domain_name = local.chat_stream_domain
    origin_id   = "lambda-chat-stream"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Origin 3: API Gateway (history REST API)
  origin {
    domain_name = local.history_api_domain
    origin_id   = "apigw-history"
    origin_path = local.history_api_stage_path

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Behavior 1: /chat → Lambda (compress=false required for streaming)
  ordered_cache_behavior {
    path_pattern     = "/chat"
    target_origin_id = "lambda-chat-stream"

    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    viewer_protocol_policy = "redirect-to-https"
    compress               = false

    # CachingDisabled
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    # AllViewerExceptHostHeader (forwards Authorization header)
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  }

  # Behavior 2: /api/* → API Gateway (CF Function strips /api, origin_path prepends /dev)
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    target_origin_id = "apigw-history"

    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # CachingDisabled
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    # AllViewerExceptHostHeader (forwards Authorization header)
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.api_rewrite.arn
    }
  }

  # Default behavior: S3 static files
  default_cache_behavior {
    target_origin_id       = "s3-frontend"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # CachingOptimized
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  # SPA fallback: S3 returns 403 for missing paths → serve /index.html
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Project = var.project_name
    Phase   = "4-C"
  }
}
