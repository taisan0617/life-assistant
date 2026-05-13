import { ThinkingBadge } from "./ThinkingBadge";
import { ToolCallBadge } from "./ToolCallBadge";
import type { Message } from "../lib/types";

interface Props {
  message: Message;
}

/**
 * 1件のメッセージを表示する。
 *
 * ユーザー: 右寄せ・青背景
 * アシスタント: 左寄せ・グレー背景
 *   内部順序: thinking → tool_call バッジ群 → 最終テキスト
 */
export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] bg-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  // アシスタントメッセージ
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%] bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed">
        {/* 思考プロセス */}
        {message.thinking && <ThinkingBadge text={message.thinking} />}

        {/* ツール呼び出しバッジ群 */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2">
            {message.toolCalls.map((tc) => (
              <ToolCallBadge key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        {/* 最終応答テキスト（改行を <br> で表示） */}
        {message.content && (
          <div className="text-gray-800 whitespace-pre-wrap">{message.content}</div>
        )}

        {/* ストリーミング中で content がまだ空のとき */}
        {!message.content && (!message.toolCalls || message.toolCalls.length === 0) && (
          <span className="text-gray-400 animate-pulse">考えています…</span>
        )}
      </div>
    </div>
  );
}
