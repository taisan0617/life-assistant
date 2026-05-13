import type { StreamEvent } from "./types";

/**
 * ReadableStream を NDJSON として解釈し、StreamEvent を逐次 yield する。
 *
 * Bedrock Lambda は各行が独立した JSON オブジェクトの NDJSON を返す。
 * ネットワーク層でバイト列が分割されて届くため、改行で分割しながら
 * 不完全な行は次のチャンクと連結してからパースする。
 */
export async function* parseNDJSONStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<StreamEvent> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      // ストリーム終了時に残ったバッファをフラッシュ
      if (buffer.trim()) {
        try {
          yield JSON.parse(buffer) as StreamEvent;
        } catch {
          console.error("NDJSON: 末尾行のパース失敗:", buffer);
        }
      }
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    // 改行で分割し、最後の不完全な行は次のループへ持ち越す
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        yield JSON.parse(line) as StreamEvent;
      } catch {
        console.error("NDJSON: 行のパース失敗:", line);
      }
    }
  }
}
