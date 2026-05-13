# Life Assistant Frontend

Bedrock Agent + Lambda ストリーミングと連携する React チャット UI です。

## 起動手順

```powershell
# 1. 依存パッケージをインストール
cd C:\life-assistant\frontend
npm install

# 2. 環境変数ファイルを作成
Copy-Item .env.example .env.local
# .env.local を開いて VITE_CHAT_STREAM_URL と VITE_HISTORY_API_URL を埋める
# terraform\envs\dev で以下を実行すると URL が取得できる:
#   terraform output -raw chat_stream_url
#   terraform output -raw history_api_endpoint

# 3. 開発サーバーを起動
npm run dev
```

ブラウザで http://localhost:5173 を開く。

## 動作確認

1. 「+ 新しい会話」ボタンをクリック
2. 入力欄に「東京の天気を教えて」と入力して送信
3. Tool call バッジが表示されながら最終応答が返ってくることを確認
4. サイドバーに会話が追加されることを確認
5. 別の会話をクリックして履歴が読み込まれることを確認

## ビルド

```powershell
npm run build
# dist/ 以下に静的ファイルが生成される（Phase 4 で S3 + CloudFront にデプロイ）
```
