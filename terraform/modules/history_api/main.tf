# ─── REST API ─────────────────────────────────────────────────────────────────

resource "aws_api_gateway_rest_api" "history" {
  name        = "bedrock-agent-history-api"
  description = "REST API for life-assistant conversation history (Phase 2)"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# ─── Resources ────────────────────────────────────────────────────────────────

# /sessions
resource "aws_api_gateway_resource" "sessions" {
  rest_api_id = aws_api_gateway_rest_api.history.id
  parent_id   = aws_api_gateway_rest_api.history.root_resource_id
  path_part   = "sessions"
}

# /sessions/{id}
resource "aws_api_gateway_resource" "session_id" {
  rest_api_id = aws_api_gateway_rest_api.history.id
  parent_id   = aws_api_gateway_resource.sessions.id
  path_part   = "{id}"
}

# ─── /sessions  GET ───────────────────────────────────────────────────────────

resource "aws_api_gateway_method" "get_sessions" {
  rest_api_id   = aws_api_gateway_rest_api.history.id
  resource_id   = aws_api_gateway_resource.sessions.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_sessions" {
  rest_api_id             = aws_api_gateway_rest_api.history.id
  resource_id             = aws_api_gateway_resource.sessions.id
  http_method             = aws_api_gateway_method.get_sessions.http_method
  integration_http_method = "POST"   # API Gateway always POSTs to Lambda
  type                    = "AWS_PROXY"
  uri                     = var.history_lambda_invoke_arn
}

# ─── /sessions  POST ──────────────────────────────────────────────────────────

resource "aws_api_gateway_method" "post_sessions" {
  rest_api_id   = aws_api_gateway_rest_api.history.id
  resource_id   = aws_api_gateway_resource.sessions.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "post_sessions" {
  rest_api_id             = aws_api_gateway_rest_api.history.id
  resource_id             = aws_api_gateway_resource.sessions.id
  http_method             = aws_api_gateway_method.post_sessions.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.history_lambda_invoke_arn
}

# ─── /sessions  OPTIONS (CORS preflight) ─────────────────────────────────────

resource "aws_api_gateway_method" "options_sessions" {
  rest_api_id   = aws_api_gateway_rest_api.history.id
  resource_id   = aws_api_gateway_resource.sessions.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_sessions" {
  rest_api_id = aws_api_gateway_rest_api.history.id
  resource_id = aws_api_gateway_resource.sessions.id
  http_method = aws_api_gateway_method.options_sessions.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options_sessions" {
  rest_api_id = aws_api_gateway_rest_api.history.id
  resource_id = aws_api_gateway_resource.sessions.id
  http_method = aws_api_gateway_method.options_sessions.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  response_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration_response" "options_sessions" {
  rest_api_id = aws_api_gateway_rest_api.history.id
  resource_id = aws_api_gateway_resource.sessions.id
  http_method = aws_api_gateway_method.options_sessions.http_method
  status_code = aws_api_gateway_method_response.options_sessions.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
  }

  depends_on = [aws_api_gateway_integration.options_sessions]
}

# ─── /sessions/{id}  GET ─────────────────────────────────────────────────────

resource "aws_api_gateway_method" "get_session" {
  rest_api_id   = aws_api_gateway_rest_api.history.id
  resource_id   = aws_api_gateway_resource.session_id.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_session" {
  rest_api_id             = aws_api_gateway_rest_api.history.id
  resource_id             = aws_api_gateway_resource.session_id.id
  http_method             = aws_api_gateway_method.get_session.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.history_lambda_invoke_arn
}

# ─── /sessions/{id}  OPTIONS (CORS preflight) ────────────────────────────────

resource "aws_api_gateway_method" "options_session_id" {
  rest_api_id   = aws_api_gateway_rest_api.history.id
  resource_id   = aws_api_gateway_resource.session_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_session_id" {
  rest_api_id = aws_api_gateway_rest_api.history.id
  resource_id = aws_api_gateway_resource.session_id.id
  http_method = aws_api_gateway_method.options_session_id.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options_session_id" {
  rest_api_id = aws_api_gateway_rest_api.history.id
  resource_id = aws_api_gateway_resource.session_id.id
  http_method = aws_api_gateway_method.options_session_id.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  response_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration_response" "options_session_id" {
  rest_api_id = aws_api_gateway_rest_api.history.id
  resource_id = aws_api_gateway_resource.session_id.id
  http_method = aws_api_gateway_method.options_session_id.http_method
  status_code = aws_api_gateway_method_response.options_session_id.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
  }

  depends_on = [aws_api_gateway_integration.options_session_id]
}

# ─── Deployment ───────────────────────────────────────────────────────────────
#
# triggers.redeployment forces a new deployment whenever any method or integration
# changes — without this, API Gateway caches the previous configuration.

resource "aws_api_gateway_deployment" "history" {
  rest_api_id = aws_api_gateway_rest_api.history.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.sessions.id,
      aws_api_gateway_resource.session_id.id,
      aws_api_gateway_method.get_sessions.id,
      aws_api_gateway_method.post_sessions.id,
      aws_api_gateway_method.options_sessions.id,
      aws_api_gateway_method.get_session.id,
      aws_api_gateway_method.options_session_id.id,
      aws_api_gateway_integration.get_sessions.id,
      aws_api_gateway_integration.post_sessions.id,
      aws_api_gateway_integration.options_sessions.id,
      aws_api_gateway_integration.get_session.id,
      aws_api_gateway_integration.options_session_id.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.get_sessions,
    aws_api_gateway_integration.post_sessions,
    aws_api_gateway_integration_response.options_sessions,
    aws_api_gateway_integration.get_session,
    aws_api_gateway_integration_response.options_session_id,
  ]
}

# ─── Stage ────────────────────────────────────────────────────────────────────

resource "aws_api_gateway_stage" "dev" {
  deployment_id = aws_api_gateway_deployment.history.id
  rest_api_id   = aws_api_gateway_rest_api.history.id
  stage_name    = "dev"
}

# ─── Lambda Permission ────────────────────────────────────────────────────────

# Allow API Gateway to invoke the history Lambda from any method/path in this API.
resource "aws_lambda_permission" "history_apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.history_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.history.execution_arn}/*/*"
}
