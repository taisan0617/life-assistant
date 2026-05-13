interface Props {
  text: string;
}

/** アシスタントの思考プロセスを小さく表示するバッジ。 */
export function ThinkingBadge({ text }: Props) {
  return (
    <div className="text-xs text-gray-400 italic mb-2 flex items-start gap-1">
      <span>💭</span>
      <span className="line-clamp-3">{text}</span>
    </div>
  );
}
