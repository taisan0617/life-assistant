import boto3
import json
import os
import subprocess
import uuid
import sys

REGION = "us-east-1"
SESSION_ID = sys.argv[2] if len(sys.argv) > 2 else str(uuid.uuid4())
INPUT_TEXT = sys.argv[1] if len(sys.argv) > 1 else "横浜の今の天気を教えて"
ENABLE_TRACE = True

# terraform output から Agent ID を動的に取得する。
# 環境変数 AGENT_ID / AGENT_ALIAS_ID で上書きも可能。
def _tf_output(key: str) -> str:
    env_val = os.environ.get(key)
    if env_val:
        return env_val
    tf_dir = os.path.join(os.path.dirname(__file__), "..", "terraform", "envs", "dev")
    result = subprocess.run(
        ["terraform", "output", "-raw", key],
        cwd=tf_dir,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"terraform output {key} failed.\n"
            "terraform/envs/dev で terraform apply 済みか確認してください。\n"
            f"stderr: {result.stderr.strip()}"
        )
    return result.stdout.strip()

AGENT_ID       = _tf_output("agent_id")
AGENT_ALIAS_ID = _tf_output("agent_alias_id")

# クライアント作成
client = boto3.client("bedrock-agent-runtime", region_name=REGION)

# Agent 呼び出し
response = client.invoke_agent(
    agentId=AGENT_ID,
    agentAliasId=AGENT_ALIAS_ID,
    sessionId=SESSION_ID,
    inputText=INPUT_TEXT,
    enableTrace=ENABLE_TRACE,
)

# EventStream を読む
print(f"=== Input: {INPUT_TEXT} ===\n")
print(f"Session ID: {SESSION_ID}\n")

final_answer = ""
traces = []

for event in response["completion"]:
    # チャンク（最終回答のテキスト）
    if "chunk" in event:
        chunk = event["chunk"]
        text = chunk["bytes"].decode("utf-8")
        final_answer += text
    # トレース情報
    elif "trace" in event:
        traces.append(event["trace"])

print("=== Final Answer ===")
print(final_answer)
print()

print("=== Traces ===")
for i, t in enumerate(traces):
    print(f"\n--- Trace {i+1} ---")
    print(json.dumps(t, indent=2, ensure_ascii=False, default=str))