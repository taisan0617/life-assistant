import json
import os
import urllib.error
import urllib.parse
import urllib.request

import boto3


def _get_secret(secret_name: str) -> dict:
    client = boto3.client("secretsmanager", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])


def _get_current_weather(city: str) -> dict:
    secret = _get_secret(os.environ["SECRET_NAME"])
    api_key = secret["api_key"]

    encoded_city = urllib.parse.quote(city)
    url = (
        f"https://api.openweathermap.org/data/2.5/weather"
        f"?q={encoded_city}&appid={api_key}&units=metric&lang=ja"
    )

    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        raise ValueError(f"OpenWeatherMap error {exc.code}: {exc.reason}") from exc

    return {
        "city": data["name"],
        "country": data["sys"]["country"],
        "temperature": round(data["main"]["temp"], 1),
        "feels_like": round(data["main"]["feels_like"], 1),
        "humidity": data["main"]["humidity"],
        "description": data["weather"][0]["description"],
        "wind_speed": round(data["wind"]["speed"], 1),
    }


def lambda_handler(event: dict, context) -> dict:
    action_group = event.get("actionGroup", "")
    api_path = event.get("apiPath", "")
    http_method = event.get("httpMethod", "GET")

    param_map = {p["name"]: p["value"] for p in event.get("parameters", [])}

    try:
        if api_path == "/getCurrentWeather":
            city = param_map.get("city", "")
            if not city:
                raise ValueError("'city' parameter is required")
            result = _get_current_weather(city)
            http_status = 200
            body = json.dumps(result, ensure_ascii=False)
        else:
            http_status = 404
            body = json.dumps({"error": f"Unknown path: {api_path}"})
    except ValueError as exc:
        http_status = 400
        body = json.dumps({"error": str(exc)})
    except Exception as exc:
        http_status = 500
        body = json.dumps({"error": "Internal error", "detail": str(exc)})

    return {
        "messageVersion": "1.0",
        "response": {
            "actionGroup": action_group,
            "apiPath": api_path,
            "httpMethod": http_method,
            "httpStatusCode": http_status,
            "responseBody": {
                "application/json": {"body": body}
            },
        },
    }
