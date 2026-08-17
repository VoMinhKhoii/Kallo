import {
  cacheQueryEmbedding,
  resolveQueryEmbedding,
} from '@/lib/ai/cache/embedding-cache';
import type { IngredientWithContext } from '@/lib/ai/matching/retrieve/top-k-context';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import { mapWithConcurrency } from '@/lib/core/async/map-with-concurrency';
import type { AppDb } from '@/lib/infra/db';

export interface TopKEmbeddingResult {
  /** One slot per pending ingredient; `null` means "run the lexical arm". */
  embeddings: (number[] | null)[];
  l3MissCount: number;
  phase1Ms: number;
  phase2Ms: number;
}

/**
 * Phases 1–2 of the v2 cascade: resolve an embedding for every ingredient the
 * exact-match short-circuit did not already answer.
 *
 * Phase 1 reads the existing L1/L2 cache; phase 2 batch-embeds the L3 misses.
 * Both are best-effort — a failure or an empty result leaves the slot `null`
 * so phase 3 degrades that ingredient to the lexical arm instead of blanking
 * it out.
 */
export async function resolveTopKEmbeddings(
  pending: IngredientWithContext[],
  db: AppDb,
  gemini: GeminiClient,
  concurrency: number
): Promise<TopKEmbeddingResult> {
  const tPhase1 = Date.now();
  const cacheSettled = await mapWithConcurrency(
    pending,
    (c) => resolveQueryEmbedding(c.matchingName, db),
    concurrency
  );
  const phase1Ms = Date.now() - tPhase1;
  const embeddings: (number[] | null)[] = cacheSettled.map((r, i) => {
    if (r.status === 'rejected') {
      console.warn(
        `[v2-matching] cache lookup failed for "${pending[i].matchingName}":`,
        r.reason
      );
      return null;
    }
    return r.value;
  });

  const tPhase2 = Date.now();
  const missIndices = embeddings
    .map((e, i) => (e ? -1 : i))
    .filter((i) => i >= 0);
  const l3MissCount = missIndices.length;
  if (missIndices.length > 0) {
    const missNames = missIndices.map((i) => pending[i].matchingName);
    console.info(`[v2-matching] batch embedding ${missNames.length} L3 misses`);
    try {
      const batchResults = await gemini.generateEmbeddingBatch(missNames);
      if (batchResults.length !== missNames.length) {
        console.warn(
          `[v2-matching] embedding batch length mismatch: expected ${missNames.length}, got ${batchResults.length}`
        );
      } else {
        for (let j = 0; j < missIndices.length; j++) {
          const embedding = batchResults[j];
          if (!embedding) continue;
          const idx = missIndices[j];
          embeddings[idx] = embedding;
          cacheQueryEmbedding(pending[idx].matchingName, embedding, db);
        }
      }
    } catch (err) {
      // Availability hole plugged: rather than returning zero candidates for
      // the whole batch, leave these embeddings null so Phase 3 runs the
      // lexical (fuzzy/trigram) fallback arm for them.
      console.warn(
        '[v2-matching] embedding batch failed; degrading to lexical fallback:',
        err
      );
    }
  }
  const phase2Ms = Date.now() - tPhase2;

  return { embeddings, l3MissCount, phase1Ms, phase2Ms };
}
