import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { capitalizeFirst } from '@/lib/utils';
import type { GeminiClient } from '../gemini';
import {
  cacheQueryEmbedding,
  normalizeIngredientKey,
  resolveQueryEmbedding,
} from './embedding-cache';

/**
 * Extract ingredient names from a partial JSON stream.
 *
 * Scans for `"name":"..."` patterns within ingredient arrays.
 * Returns only NEW names not seen in previous calls (tracked via `seen` set).
 */
export function extractIngredientNames(
  accumulated: string,
  seen: Set<string>
): string[] {
  const newNames: string[] = [];
  // Match "name" followed by a colon and a quoted string value
  const re = /"name"\s*:\s*"([^"]+)"/g;
  let match = re.exec(accumulated);
  while (match !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      newNames.push(name);
    }
    match = re.exec(accumulated);
  }
  return newNames;
}

/**
 * Create a speculative matcher that pre-warms the embedding cache
 * as ingredient names are discovered in the decomposition stream.
 *
 * Returns an `onChunk` callback for the streaming decomposition call.
 * Each newly discovered ingredient name triggers:
 * 1. L1/L2 cache lookup (instant if hit)
 * 2. On L1/L2 miss → Gemini embedding API call (fire-and-forget),
 *    result cached to L1+L2 so the batch phase in cascade.ts finds it.
 */
export function createSpeculativeMatcher(
  db: PostgresJsDatabase<any>,
  gemini: GeminiClient
) {
  const seen = new Set<string>();
  /**
   * In-flight promises keyed by normalized canonical name.
   * Prevents duplicate Gemini calls when the LLM emits equivalent names
   * with different capitalization (e.g. "cà rốt" then "Cà rốt" in the same
   * stream). Both map to the same dedup key after normalizeIngredientKey.
   * Request-scoped: a new map is created per call to createSpeculativeMatcher.
   */
  const inFlight = new Map<string, Promise<void>>();

  return (accumulated: string) => {
    const newNames = extractIngredientNames(accumulated, seen);
    for (const rawName of newNames) {
      // Match the capitalizeFirst() applied in orchestrator after stream completes
      // so the embeddingCache key in gemini.ts matches cascade's batch lookup key.
      const name = capitalizeFirst(rawName);

      // Use the same normalization as resolveQueryEmbedding's internal key for
      // deduplication — catches equivalent names with different capitalization.
      const dedupeKey = normalizeIngredientKey(name);
      if (inFlight.has(dedupeKey)) continue;

      const promise = resolveQueryEmbedding(name, db)
        .then((cached) => {
          if (cached) return; // L1/L2 hit — already warm
          // L3 miss: fire Gemini embed and cache result
          return gemini.generateEmbedding(name).then((embedding) => {
            cacheQueryEmbedding(name, embedding, db);
          });
        })
        .catch(() => {}) // Silently ignore errors — matching phase will retry
        .finally(() => inFlight.delete(dedupeKey));

      inFlight.set(dedupeKey, promise);
    }
  };
}
