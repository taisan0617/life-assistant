variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "project_name" {
  description = "Project name prefix for IAM role naming"
  type        = string
}

variable "lambda_src_path" {
  description = "Absolute path to the Lambda source code directory"
  type        = string
}

variable "secret_name" {
  description = "Secrets Manager secret name for the OpenWeather API key"
  type        = string
}
