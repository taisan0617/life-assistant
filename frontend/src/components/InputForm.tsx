import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface Props {
  onSend: (text: string) => void;
  isDisabled: boolean;
}

/**
 * メッセージ入力フォーム。
 * - textarea は入力内容に応じて自動リサイズ（最大 200px）
 * - Enter で送信、Shift+Enter で改行
 * - isDisabled=true（ストリーミング中）はボタンと入力を無効化
 */
export function InputForm({ onSend, isDisabled }: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // textarea の高さを内容に合わせて調整
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || isDisabled) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t bg-white px-4 py-3">
      <div className="flex items-end gap-2 max-w-3xl mx-auto">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力… (Shift+Enter で改行)"
          rows={1}
          disabled={isDisabled}
          className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:bg-gray-50 disabled:text-gray-400
                     transition-shadow leading-relaxed"
        />
        <button
          onClick={handleSubmit}
          disabled={isDisabled || !text.trim()}
          className="flex-shrink-0 h-10 w-10 rounded-xl bg-blue-500 text-white
                     flex items-center justify-center
                     hover:bg-blue-600 disabled:bg-gray-200 disabled:cursor-not-allowed
                     transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
