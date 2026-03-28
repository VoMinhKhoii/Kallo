import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/**
 * Normalize an ingredient name for consistent cache keys.
 * Applies NFC Unicode normalization, lowercases, and trims whitespace.
 * Must be called once at every entry point before any lookup logic.
 */
export function normalizeIngredientKey(name: string): string {
  return name.normalize('NFC').toLowerCase().trim();
}

/**
 * L1 in-memory cache for query embeddings.
 * Keyed by normalized ingredient name.
 */
const memoryCache = new Map<string, number[]>();

/** Visible for testing/diagnostics */
export function getMemoryCacheStats() {
  return { size: memoryCache.size };
}

/** @internal Exported for testing */
export function clearMemoryCache() {
  memoryCache.clear();
}

/**
 * Tiered embedding lookup: L1 memory → L2 exact (name_vi only) → null.
 *
 * Input is normalized (NFC + lowercase + trim) before any tier is checked.
 * L2 matches on name_vi only — name_en is not used in the live lookup.
 * On miss, asynchronously checks name_en for synonym candidate logging.
 */
export async function resolveQueryEmbedding(
  ingredientName: string,
  db: PostgresJsDatabase<any>
): Promise<number[] | null> {
  const normalized = normalizeIngredientKey(ingredientName);

  // L1: in-memory cache
  const cached = memoryCache.get(normalized);
  if (cached) return cached;

  // L2: exact match on name_vi only
  const exactRows = await db.execute(
    sql`SELECT name_vi, name_en, embedding
        FROM ingredient_query_embeddings
        WHERE name_vi = ${normalized}
        LIMIT 1`
  );

  if (exactRows.length > 0) {
    return promoteToMemoryCache(exactRows[0] as Record<string, unknown>);
  }

  // Miss — async: check name_en for synonym candidate logging (fire-and-forget)
  logSynonymCandidateIfEnMatch(normalized, db);

  return null;
}

/**
 * Fire-and-forget: cache a query embedding into L1 memory + L2 DB table.
 * Inserts as name_vi (the pipeline's primary output language is Vietnamese).
 * name_en is left NULL — filled later by the translation backfill script.
 * Input is normalized before storage.
 */
export function cacheQueryEmbedding(
  ingredientName: string,
  embedding: number[],
  db: PostgresJsDatabase<any>
): void {
  const normalized = normalizeIngredientKey(ingredientName);

  // L1: always populate memory cache synchronously
  memoryCache.set(normalized, embedding);

  // L2: async insert into DB — fire-and-forget
  db.execute(
    sql`INSERT INTO ingredient_query_embeddings (name_vi, embedding)
        VALUES (${normalized}, ${JSON.stringify(embedding)}::vector)
        ON CONFLICT (name_vi) DO NOTHING`
  ).catch((err) => {
    console.error(
      `[embedding-cache] Failed to persist embedding for "${normalized}":`,
      err
    );
  });
}

/**
 * Promote a DB row into L1 memory cache.
 * Caches under BOTH name_vi and name_en keys (when available)
 * so subsequent lookups in either language hit L1.
 */
function promoteToMemoryCache(row: Record<string, unknown>): number[] | null {
  const embedding = parseEmbeddingValue(row.embedding);
  if (!embedding) return null;

  const nameVi = row.name_vi as string | null;
  const nameEn = row.name_en as string | null;

  if (nameVi) memoryCache.set(nameVi, embedding);
  if (nameEn) memoryCache.set(nameEn, embedding);

  return embedding;
}

/**
 * On cache miss, check if any row's name_en matches the query.
 * If so, log a synonym candidate for later review.
 * Entirely fire-and-forget — never blocks the caller.
 */
function logSynonymCandidateIfEnMatch(
  normalizedQuery: string,
  db: PostgresJsDatabase<any>
): void {
  db.execute(
    sql`SELECT name_vi, name_en
        FROM ingredient_query_embeddings
        WHERE lower(name_en) = ${normalizedQuery}
        LIMIT 1`
  )
    .then((rows) => {
      if (rows.length > 0) {
        const row = rows[0] as Record<string, unknown>;
        return db.execute(
          sql`INSERT INTO synonym_candidates (queried_vi, matched_en, matched_vi)
              VALUES (${normalizedQuery}, ${row.name_en as string}, ${row.name_vi as string})`
        );
      }
    })
    .catch((err) => {
      console.error('[embedding-cache] Failed to log synonym candidate:', err);
    });
}

/**
 * Parse a pgvector embedding value from the DB.
 * pgvector returns either a string like "[0.1,0.2,...]" or a number[].
 */
function parseEmbeddingValue(raw: unknown): number[] | null {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as number[];
    } catch {
      return null;
    }
  }
  return null;
}
