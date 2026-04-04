import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ConcurrencyQueue, capitalizeFirst } from '@/lib/utils';
import type { GeminiClient } from '../gemini';
import { resolveAlias } from './aliases';
import type { MatchInfo } from './cascade';
import { matchSingleIngredientWithEmbedding } from './cascade';
import { cacheQueryEmbedding, resolveQueryEmbedding } from './embedding-cache';

export interface ConcurrentMatchTask {
  ingredientName: string;
  matchInfo: MatchInfo | null;
}

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

  return (accumulated: string) => {
    const newNames = extractIngredientNames(accumulated, seen);
    for (const name of newNames) {
      // Fire-and-forget: pre-warm embedding cache through all tiers
      resolveQueryEmbedding(name, db)
        .then((cached) => {
          if (cached) return; // L1/L2 hit — already warm
          // L3 miss: fire Gemini embed and cache result
          return gemini.generateEmbedding(name).then((embedding) => {
            cacheQueryEmbedding(name, embedding, db);
          });
        })
        .catch(() => {}); // Silently ignore errors — matching phase will retry
    }
  };
}

/**
 * Creates a concurrent matcher that overlaps DB querying with LLM streaming.
 * Uses a concurrency queue to prevent exhausting PgBouncer.
 */
export function createConcurrentMatcher(
  db: PostgresJsDatabase<any>,
  gemini: GeminiClient,
  matchPromises: Promise<ConcurrentMatchTask>[]
) {
  const seen = new Set<string>();
  const queue = new ConcurrencyQueue(4);
  let lastScannedLength = 0;

  return (accumulated: string) => {
    // Only scan the new part of the string + a small lookbehind buffer
    // to catch "name":"..." tokens that were split across chunks.
    // The lookbehind (e.g. 50 chars) ensures we don't miss a token
    // whose start was at the very end of the previous accumulated string.
    const lookbehind = Math.max(0, lastScannedLength - 50);
    const textToScan = accumulated.slice(lookbehind);

    const newNames = extractIngredientNames(textToScan, seen);
    lastScannedLength = accumulated.length;

    for (const name of newNames) {
      const task = queue.add(async (): Promise<ConcurrentMatchTask> => {
        try {
          const finalName = resolveAlias(capitalizeFirst(name));

          let embedding = await resolveQueryEmbedding(finalName, db);
          if (!embedding) {
            embedding = await gemini.generateEmbedding(finalName);
            cacheQueryEmbedding(finalName, embedding, db);
          }
          const matchInfo = await matchSingleIngredientWithEmbedding(
            finalName,
            embedding,
            db
          );
          return { ingredientName: finalName, matchInfo };
        } catch (err) {
          console.error(
            `[matching] Concurrent match failed for "${name}":`,
            err
          );
          return {
            ingredientName: resolveAlias(capitalizeFirst(name)),
            matchInfo: null,
          };
        }
      });
      matchPromises.push(task);
    }
  };
}
