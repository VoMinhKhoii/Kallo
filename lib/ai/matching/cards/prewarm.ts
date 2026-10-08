/**
 * Embedding prewarm for card retrieval. As Call 1 streams, every completed
 * query-field value (QUERY_FIELDS) is embedded in the background, one batch per
 * new chunk, so retrieval finds the vectors in the provider memo (which also
 * joins a request still in flight) instead of waiting on the embedding API.
 * Never throws into the stream; stops once `signal` aborts.
 */
import type { GeminiClient } from '@/lib/ai/provider/provider';
import { asRetrieved, QUERY_FIELDS, type QueryField } from './query-strings';

const FIELD = new RegExp(
  `"(${QUERY_FIELDS.map((f) => f.field).join('|')})"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`,
  'g'
);

export function createCardEmbeddingPrewarm(
  gemini: GeminiClient,
  signal?: AbortSignal
) {
  const seen = new Set<string>();
  return (accumulated: string) => {
    if (signal?.aborted) return;
    const fresh: string[] = [];
    try {
      for (const m of accumulated.matchAll(FIELD)) {
        const text = asRetrieved(m[1] as QueryField, JSON.parse(`"${m[2]}"`));
        if (text.trim() && !seen.has(text)) {
          seen.add(text);
          fresh.push(text);
        }
      }
    } catch {
      return; // A malformed partial value must never surface into the stream.
    }
    if (fresh.length) gemini.generateEmbeddingBatch(fresh).catch(() => {});
  };
}
