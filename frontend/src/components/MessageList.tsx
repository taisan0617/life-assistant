import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import type { Message } from "../lib/types";

interface Props {
  messages: Message[];
}

/**
 * メッセージ一覧を縦に並べ、新しいメッセージが追加されると
 * 自動でスクロールダウンする。
 */
export function MessageList({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // メッセージ更新のたびに末尾にスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        <div className="text-center">
          <p className="text-2xl mb-2">🌤️</p>
          <p>何でも聞いてください</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      {messages.map((msg, index) => (
        <MessageBubble key={index} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
