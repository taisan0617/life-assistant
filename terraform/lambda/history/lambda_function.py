"""
history-handler Lambda — REST API for conversation history.

Routes (via API Gateway Lambda Proxy Integration):
  GET  /sessions        List all sessions for the default user (newest first via GSI)
  GET  /sessions/{id}   List all messages in a specific session (oldest first)
  POST /sessions        Create an empty named session

All responses include CORS headers for Phase 3 React UI integration.
"""

import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

TABLE_NAME      = os.environ["DYNAMODB_TABLE"]
DEFAULT_USER_ID = os.environ["DEFAULT_USER_ID"]

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


# ─── Route Handlers ───────────────────────────────────────────────────────────

def list_sessions(user_id: str) -> dict:
    """Return all sessions for user_id, sorted newest-first via GSI."""
    result = table.query(
        IndexName     = "userId-updatedAt-index",
        KeyConditionExpression = Key("userId").eq(user_id),
        ScanIndexForward = False,   # descending updatedAt → newest first
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
        ScanIndexForward = True,    # ascending SK → oldest first
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
    method     = event.get("httpMethod", "")
    path       = event.get("path", "")
    path_params = event.get("pathParameters") or {}
    session_id = path_params.get("id")
    user_id    = DEFAULT_USER_ID

    # ── OPTIONS (CORS preflight) ─────────────────────────────────────────────
    if method == "OPTIONS":
        return _resp(200, {})

    # ── GET /sessions ────────────────────────────────────────────────────────
    if method == "GET" and path == "/sessions":
        return list_sessions(user_id)

    # ── GET /sessions/{id} ───────────────────────────────────────────────────
    if method == "GET" and session_id:
        return get_session_messages(session_id)

    # ── POST /sessions ───────────────────────────────────────────────────────
    if method == "POST" and path == "/sessions":
        try:
            body = json.loads(event.get("body") or "{}")
        except (json.JSONDecodeError, TypeError):
            body = {}
        return create_session(user_id, body)

    return _resp(404, {"error": f"No route for {method} {path}"})
