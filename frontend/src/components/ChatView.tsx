import { MessageList } from "./MessageList";
import { InputForm } from "./InputForm";
import type { Message } from "../lib/types";

interface Props {
  messages: Message[];
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
}

/** チャット画面のメインエリア。メッセージ一覧と入力フォームを縦に並べる。 */
export function ChatView({ messages, isStreaming, onSendMessage }: Props) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <MessageList messages={messages} />
      <InputForm onSend={onSendMessage} isDisabled={isStreaming} />
    </div>
  );
}
