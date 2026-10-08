/**
 * Embedding prewarm for card retrieval. As Call 1 streams, every completed
 * card query string (rawName, canonicalName, queryEn, nameVi) is embedded in
 * the background, one batch per new chunk, so `matchCardCandidates` finds the
 * vectors in the provider memo instead of waiting on the embedding API.
 *
 * Strings must be byte-identical to what retrieval asks for: the decomposition
 * stage capitalizes rawName/canonicalName after the stream, so the same
 * `capitalizeFirst` is applied here. Never throws into the stream; stops once
 * `signal` aborts.
 */
import type { GeminiClient } from '@/lib/ai/provider/provider';
import { capitalizeFirst } from '@/lib/core/text/capitalize';

const FIELD =
  /"(rawName|canonicalName|queryEn|nameVi)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
const CAPITALIZED = new Set(['rawName', 'canonicalName']);

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
        const value = JSON.parse(`"${m[2]}"`) as string;
        const text = CAPITALIZED.has(m[1]) ? capitalizeFirst(value) : value;
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
