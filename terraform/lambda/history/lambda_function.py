"""
history-handler Lambda — REST API for conversation history.

認証:
    API Gateway の Cognito Authorizer が JWT を検証済みで、
    event["requestContext"]["authorizer"]["claims"]["sub"] にユーザーIDが入っている。

Routes (API Gateway Lambda Proxy Integration):
    GET  /sessions        ログイン中ユーザーの会話一覧 (最新順)
    GET  /sessions/{id}   特定セッションの全メッセージ (古い順)
    POST /sessions        空のセッションを新規作成

All responses include CORS headers for Phase 3/4 React UI integration.
"""

import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ["DYNAMODB_TABLE"]

dynamodb = boto3.resource("dynamodb")
table    = dynamodb.Table(TABLE_NAME)

CORS_HEADERS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Content-Type":                 "application/json",
}


# ─── Response Helper ──────────────────────────────────────────────────────────

def _resp(status: int, body) -> dict:
    return {
        "statusCode": status,
        "headers":    CORS_HEADERS,
        "body":       json.dumps(body, ensure_ascii=False, default=str),
    }


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── 認証ヘルパー ──────────────────────────────────────────────────────────────

def _get_user_id(event: dict) -> str | None:
    """
    Cognito Authorizer が設定した claims から sub (ユーザーID) を取得する。
    認証なしでリクエストが届いた場合は None を返す。
    """
    claims = (
        event.get("requestContext", {})
             .get("authorizer", {})
             .get("claims", {})
    )
    return claims.get("sub") or None


# ─── Route Handlers ───────────────────────────────────────────────────────────

def list_sessions(user_id: str) -> dict:
    """Return all sessions for user_id, sorted newest-first via GSI."""
    result = table.query(
        IndexName              = "userId-updatedAt-index",
        KeyConditionExpression = Key("userId").eq(user_id),
        ScanIndexForward       = False,  # descending updatedAt → newest first
    )
    sessions = [
        {
            "sessionId":   item.get("sessionId"),
            "title":       item.get("title", ""),
            "lastMessage": item.get("lastMessage", ""),
            "createdAt":   item.get("createdAt"),
            "updatedAt":   item.get("updatedAt"),
        }
        for item in result.get("Items", [])
    ]
    return _resp(200, {"sessions": sessions})


def get_session_messages(session_id: str) -> dict:
    """Return all messages in a session, sorted oldest-first."""
    result = table.query(
        KeyConditionExpression = (
            Key("PK").eq(f"SESSION#{session_id}") &
            Key("SK").begins_with("MSG#")
        ),
        ScanIndexForward = True,  # ascending SK → oldest first
    )
    messages = [
        {
            "messageId": item.get("messageId"),
            "role":      item.get("role"),
            "content":   item.get("content"),
            "toolCalls": item.get("toolCalls", []),
            "createdAt": item.get("createdAt"),
        }
        for item in result.get("Items", [])
    ]
    return _resp(200, {"sessionId": session_id, "messages": messages})


def create_session(user_id: str, body: dict) -> dict:
    """Create an empty session record and return its ID."""
    session_id = str(uuid.uuid4())
    now        = _now()
    title      = body.get("title", "New conversation")[:60]

    table.put_item(Item={
        "PK":          f"USER#{user_id}",
        "SK":          f"SESSION#{session_id}",
        "userId":      user_id,
        "sessionId":   session_id,
        "title":       title,
        "createdAt":   now,
        "updatedAt":   now,
        "lastMessage": "",
    })
    return _resp(201, {"sessionId": session_id, "title": title, "createdAt": now})


# ─── Lambda Entry Point ────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """API Gateway Lambda Proxy integration handler."""
    method      = event.get("httpMethod", "")
    path        = event.get("path", "")
    path_params = event.get("pathParameters") or {}
    session_id  = path_params.get("id")

    # OPTIONS は Cognito Authorizer をかけていないので claims は届かない
    if method == "OPTIONS":
        return _resp(200, {})

    # Cognito Authorizer の claims から userId を取得
    user_id = _get_user_id(event)
    if not user_id:
        return _resp(401, {"error": "Unauthorized"})

    if method == "GET" and path == "/sessions":
        return list_sessions(user_id)

    if method == "GET" and session_id:
        return get_session_messages(session_id)

    if method == "POST" and path == "/sessions":
        try:
            body = json.loads(event.get("body") or "{}")
        except (json.JSONDecodeError, TypeError):
            body = {}
        return create_session(user_id, body)

    return _resp(404, {"error": f"No route for {method} {path}"})
