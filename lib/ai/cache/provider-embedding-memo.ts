/**
 * Process-wide memo of embedding vectors, keyed by the EXACT text handed to
 * `gemini.generateEmbedding` / `generateEmbeddingBatch`.
 *
 * This is deliberately NOT the same cache as `@/lib/ai/cache/embedding-cache`,
 * and the two are not interchangeable:
 *
 * - Different keys. `embedding-cache` keys on `normalizeIngredientKey(name)`
 *   (NFC + lowercase + trim); this memo keys on the raw string. "Cà rốt" and
 *   "cà rốt" are one entry there and two here.
 * - Different layer. `embedding-cache` sits in front of the DB tiers (L1
 *   memory + L2 `ingredient_query_embeddings`); this sits at the SDK call
 *   boundary and is the last thing between a caller and a paid API request.
 * - Different lifetime guarantees. `embedding-cache` writes are gated on
 *   `PIPELINE_EMBEDDING_CACHE_ENABLED`; this memo is not. With that flag off,
 *   `resolveQueryEmbedding` always returns null and this memo is the ONLY
 *   thing suppressing duplicate embed calls.
 *
 * Deleting it would change hit behaviour on the live paths, so it stays:
 *
 * 1. Speculative prewarm (`lib/ai/matching/speculative.ts`) fires
 *    `generateEmbedding(capitalizeFirst(name))` in the background during the
 *    Call-1 stream, then writes L1 via `cacheQueryEmbedding`. If the matcher's
 *    phase-1 `resolveQueryEmbedding` runs BEFORE that background write lands,
 *    the name falls through to the phase-2 batch — and only this memo, keyed
 *    on the identical raw string, stops it becoming a second API call. The
 *    `capitalizeFirst` call in speculative.ts exists specifically to make that
 *    raw key line up with the matcher's `matchingName`.
 * 2. With the embedding-cache flag disabled, this is the sole cache.
 *
 * It is unbounded and never evicted — safe today because the key space is the
 * recurring Vietnamese ingredient vocabulary, but it has no TTL and no cap,
 * unlike `@/lib/ai/cache/l4-cache`.
 */
const memo = new Map<string, number[]>();

/** Visible for testing/diagnostics */
export function getEmbeddingCacheStats() {
  return { size: memo.size };
}

export function getMemoizedEmbedding(text: string): number[] | undefined {
  return memo.get(text);
}

export function memoizeEmbedding(text: string, embedding: number[]): void {
  memo.set(text, embedding);
}

/** Entry count, for the miss-logging line in the provider. */
export function memoizedEmbeddingCount(): number {
  return memo.size;
}
