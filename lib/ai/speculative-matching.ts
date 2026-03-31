import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { resolveQueryEmbedding } from './matching/embedding-cache';

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
 * Each newly discovered ingredient name triggers a fire-and-forget
 * L1/L2 embedding cache lookup — if the embedding is already cached,
 * it's available instantly when matching runs later.
 */
export function createSpeculativeMatcher(db: PostgresJsDatabase<any>) {
  const seen = new Set<string>();

  return (accumulated: string) => {
    const newNames = extractIngredientNames(accumulated, seen);
    for (const name of newNames) {
      // Fire-and-forget: pre-warm L1/L2 cache. Errors are silently ignored.
      resolveQueryEmbedding(name, db).catch(() => {});
    }
  };
}
