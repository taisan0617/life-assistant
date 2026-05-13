import { Plus } from "lucide-react";

interface Props {
  onClick: () => void;
}

/** サイドバー上部の「新しい会話」ボタン。 */
export function NewChatButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg
                 border border-gray-200 text-sm font-medium text-gray-700
                 hover:bg-gray-50 transition-colors"
    >
      <Plus className="h-4 w-4" />
      新しい会話
    </button>
  );
}
