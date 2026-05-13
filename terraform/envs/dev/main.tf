locals {
  # Resolve the terraform/ root from envs/dev/ (two levels up)
  project_root = abspath("${path.module}/../..")
}

# ─── Phase 1 ──────────────────────────────────────────────────────────────────

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

# ─── Phase 2 ──────────────────────────────────────────────────────────────────

module "dynamodb" {
  source = "../../modules/dynamodb"

  table_name   = "bedrock-agent-conversations"
  project_name = var.project_name
}

module "chat_stream_handler" {
  source = "../../modules/chat_stream_handler"

  aws_region          = var.aws_region
  project_name        = var.project_name
  agent_id            = module.bedrock_agent.agent_id
  agent_alias_id      = module.bedrock_agent.agent_alias_id
  dynamodb_table_name = module.dynamodb.table_name
  dynamodb_table_arn  = module.dynamodb.table_arn
  lambda_src_path     = "${local.project_root}/lambda/chat_stream"
}

module "history_handler" {
  source = "../../modules/history_handler"

  project_name        = var.project_name
  dynamodb_table_name = module.dynamodb.table_name
  dynamodb_table_arn  = module.dynamodb.table_arn
  lambda_src_path     = "${local.project_root}/lambda/history"
}

module "history_api" {
  source = "../../modules/history_api"

  project_name              = var.project_name
  history_lambda_invoke_arn = module.history_handler.invoke_arn
  history_lambda_name       = module.history_handler.function_name
}
