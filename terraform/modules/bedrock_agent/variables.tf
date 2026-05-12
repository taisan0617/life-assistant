variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "project_name" {
  description = "Project name prefix for IAM role naming"
  type        = string
}

variable "lambda_function_arn" {
  description = "ARN of the weather Lambda function (action group executor)"
  type        = string
}

variable "schema_src_path" {
  description = "Absolute path to the OpenAPI schema YAML file to upload to S3"
  type        = string
}

variable "agent_instructions_path" {
  description = "Absolute path to the agent instructions text file"
  type        = string
}

variable "foundation_model_id" {
  description = <<-EOT
    Bedrock foundation model ID or cross-region inference profile ID.
    Cross-region inference profiles (us.*) route traffic across regions for
    higher availability and throughput. These cannot be validated via the
    aws_bedrock_foundation_model data source — they are passed directly.
    See: https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html
  EOT
  type        = string
  default     = "us.anthropic.claude-sonnet-4-6"
}
