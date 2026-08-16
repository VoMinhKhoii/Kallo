import {
  cacheQueryEmbedding,
  resolveQueryEmbedding,
} from '@/lib/ai/cache/embedding-cache';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import { mapWithConcurrency } from '@/lib/async/map-with-concurrency';
import type { AppDb } from '@/lib/db';

/**
 * Max concurrent DB calls during matching cascade (Phase 1 cache resolve,
 * Phase 3 vector/fuzzy match, Phase 3b alias fallback). Bumping above 2
 * collapses sequential per-ingredient round-trips: with N=6 ingredients,
 * concurrency=2 yields 3 rounds vs concurrency=4 yields ~2 rounds, saving
 * ~30 ms per round on a typical pgvector query path. Cap is bounded by the
 * Postgres connection pool (PgBouncer transaction pool size).
 *
 * Phase C5: env-tunable so operators can roll forward without redeploying.
 * Default 4; previous default was 2 (overly conservative for the current pool).
 */
const MATCH_CONCURRENCY_DEFAULT_FALLBACK = 4;

export function readMatchConcurrencyDefault(): number {
  const raw = process.env.PIPELINE_MATCH_CONCURRENCY;
  if (!raw) return MATCH_CONCURRENCY_DEFAULT_FALLBACK;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : MATCH_CONCURRENCY_DEFAULT_FALLBACK;
}

/**
 * Phases 1–2 of the v1 cascade: resolve one embedding per matching name.
 *
 * L1/L2 cache hits are resolved first with bounded concurrency, then every L3
 * miss is collected into a single batch Gemini call. A name left without an
 * embedding is returned as `null` — the caller enqueues it as unmatched
 * without spending a match round-trip on it.
 */
export async function resolveMatchEmbeddings(
  matchingNames: string[],
  db: AppDb,
  gemini: GeminiClient,
  matchConcurrency: number
): Promise<(number[] | null)[]> {
  const cacheSettled = await mapWithConcurrency(
    matchingNames,
    (name) => resolveQueryEmbedding(name, db),
    matchConcurrency
  );
  const cacheResults = cacheSettled.map((r, i) => {
    if (r.status === 'rejected') {
      console.warn(
        `[matching] cache lookup failed for "${matchingNames[i]}", treating as cold miss:`,
        r.reason
      );
    }
    return r.status === 'fulfilled' ? r.value : null;
  });
  const embeddings: (number[] | null)[] = cacheResults.slice();
  const missIndices: number[] = [];
  for (let i = 0; i < cacheResults.length; i++) {
    if (!cacheResults[i]) missIndices.push(i);
  }

  if (missIndices.length > 0) {
    const missNames = missIndices.map((i) => matchingNames[i]);
    console.info(`[matching] batch embedding ${missNames.length} L3 misses`);
    const batchResults = await gemini.generateEmbeddingBatch(missNames);
    if (batchResults.length !== missNames.length) {
      console.warn(
        `[matching] embedding batch length mismatch: expected ${missNames.length}, got ${batchResults.length}; unaligned entries left unmatched`
      );
    } else {
      for (let j = 0; j < missIndices.length; j++) {
        const embedding = batchResults[j];
        if (!embedding) {
          console.warn(
            `[matching] no embedding returned for "${missNames[j]}", leaving unmatched`
          );
          continue;
        }
        const idx = missIndices[j];
        embeddings[idx] = embedding;
        cacheQueryEmbedding(matchingNames[idx], embedding, db);
      }
    }
  }

  return embeddings;
}
