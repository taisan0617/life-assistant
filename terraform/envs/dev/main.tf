locals {
  # Resolve the terraform/ root from envs/dev/ (two levels up)
  project_root = abspath("${path.module}/../..")
}

module "weather_lambda" {
  source = "../../modules/weather_lambda"

  aws_region      = var.aws_region
  project_name    = var.project_name
  lambda_src_path = "${local.project_root}/lambda/weather_action"
  secret_name     = "bedrock-agent/openweather"
}

module "bedrock_agent" {
  source = "../../modules/bedrock_agent"

  aws_region              = var.aws_region
  project_name            = var.project_name
  lambda_function_arn     = module.weather_lambda.lambda_function_arn
  schema_src_path         = "${local.project_root}/schemas/weather-openapi.yaml"
  agent_instructions_path = "${local.project_root}/agent_instructions.txt"
}
