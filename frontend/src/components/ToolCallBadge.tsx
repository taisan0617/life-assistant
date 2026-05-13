import { useState } from "react";
import { Wrench, CheckCircle2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { ToolCall } from "../lib/types";

interface Props {
  toolCall: ToolCall;
}

/**
 * Action Group の1回の呼び出しをカード形式で表示する。
 * - 実行中: スピナー表示
 * - 完了: チェックマーク + 結果の折りたたみ表示
 */
export function ToolCallBadge({ toolCall }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isDone = !!toolCall.endedAt;

  return (
    <div className="border border-gray-200 rounded-lg p-3 text-sm bg-white my-1">
      {/* ヘッダー行: アイコン・名前・ステータス */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Wrench className="h-4 w-4 text-orange-400 flex-shrink-0" />
          <span className="font-medium text-gray-700 truncate">
            {toolCall.actionGroup}
          </span>
          <span className="text-gray-300">→</span>
          <span className="font-mono text-xs text-gray-500 truncate">
            {toolCall.function}
          </span>
        </div>
        {isDone ? (
          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
        ) : (
          <Loader2 className="h-4 w-4 text-blue-400 animate-spin flex-shrink-0" />
        )}
      </div>

      {/* パラメーター */}
      {Object.keys(toolCall.parameters).length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {Object.entries(toolCall.parameters).map(([key, value]) => (
            <span key={key} className="text-xs text-gray-500">
              <span className="text-gray-400">{key}:</span> {value}
            </span>
          ))}
        </div>
      )}

      {/* 結果の折りたたみ（完了時のみ） */}
      {isDone && toolCall.result !== undefined && (
        <>
          <button
            className="mt-2 text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                結果を非表示
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                結果を表示
              </>
            )}
          </button>
          {expanded && (
            <pre className="mt-2 text-xs bg-gray-50 border border-gray-100 rounded p-2 overflow-auto max-h-48 text-gray-600">
              {JSON.stringify(toolCall.result, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
