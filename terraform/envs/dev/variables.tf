variable "aws_region" {
  description = "AWS region to deploy all resources"
  type        = string
}

variable "project_name" {
  description = "Project name used as a prefix for resource naming (e.g. IAM roles)"
  type        = string
}
