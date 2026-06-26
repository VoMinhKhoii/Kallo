import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import type * as schema from '@/lib/db/schema';

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
  warmCacheStarted = false;
}

/**
 * Guards one-time warm-up: set to true before the first warm call so
 * concurrent requests don't all trigger a full table scan simultaneously.
 * NOT set at module init — DATABASE_URL may be absent at build/test time.
 */
let warmCacheStarted = false;

const isEmbeddingCacheEnabled = () =>
  readBooleanEnv('PIPELINE_EMBEDDING_CACHE_ENABLED', true);
const isEmbeddingCacheWarmupEnabled = () =>
  readBooleanEnv('PIPELINE_EMBEDDING_CACHE_WARMUP_ENABLED', true);

/**
 * Warm L1 memory cache from the 526 VN FCT food items (source_id = 1).
 *
 * Loads directly from `vietnamese_food_composition` — the authoritative source
 * of pre-computed embeddings — rather than from the query cache table which
 * only accumulates entries as users search. This ensures L1 is pre-populated
 * with all common Vietnamese food names from the first request.
 *
 * Safe to call concurrently — the boolean guard ensures the DB load runs
 * exactly once per process. On DB error the warm-up is skipped silently;
 * individual lookups fall back to L2 (per-query DB fetch) as before.
 */
export async function warmEmbeddingCache(
  db: PostgresJsDatabase<typeof schema>
): Promise<void> {
  if (warmCacheStarted) return;
  if (!isEmbeddingCacheEnabled() || !isEmbeddingCacheWarmupEnabled()) return;
  warmCacheStarted = true;

  try {
    const rows = await db.execute(
      sql`SELECT name_primary, name_en, embedding
          FROM vietnamese_food_composition
          WHERE source_id = 1 AND embedding IS NOT NULL`
    );

    let loaded = 0;
    for (const row of rows as unknown as Record<string, unknown>[]) {
      const embedding = parseEmbeddingValue(row.embedding);
      if (!embedding) continue;
      const nameVi = row.name_primary as string | null;
      const nameEn = row.name_en as string | null;
      if (nameVi) {
        memoryCache.set(normalizeIngredientKey(nameVi), embedding);
        loaded++;
      }
      if (nameEn) {
        memoryCache.set(normalizeIngredientKey(nameEn), embedding);
      }
    }

    console.info(`[embedding-cache] Warm-up: loaded ${loaded} embeddings`);
  } catch (err) {
    console.warn('[embedding-cache] Warm-up failed, continuing without:', err);
    warmCacheStarted = false; // allow retry on next request
  }
}

/**
 * Prime L1 from rows already fetched by another caller — used by
 * `nutrition-cache.loadAll` so the boot-time `SELECT * FROM
 * vietnamese_food_composition WHERE source_id = 1` runs once instead of twice.
 * Marks the cache as warmed so later explicit warm-up attempts become no-ops.
 */
export function primeEmbeddingCacheFromRows(
  rows: Iterable<Record<string, unknown>>
): void {
  if (!isEmbeddingCacheEnabled() || !isEmbeddingCacheWarmupEnabled()) return;
  let loaded = 0;
  for (const row of rows) {
    const embedding = parseEmbeddingValue(row.embedding);
    if (!embedding) continue;
    const nameVi = row.name_primary as string | null;
    const nameEn = row.name_en as string | null;
    if (nameVi) {
      memoryCache.set(normalizeIngredientKey(nameVi), embedding);
      loaded++;
    }
    if (nameEn) {
      memoryCache.set(normalizeIngredientKey(nameEn), embedding);
    }
  }
  warmCacheStarted = true;
  console.info(
    `[embedding-cache] primed ${loaded} embeddings from co-loaded rows`
  );
}

/**
 * Tiered embedding lookup: L1 memory → L2 exact (name_vi OR name_en) → null.
 *
 * Input is normalized (NFC + lowercase + trim) before any tier is checked.
 * L2 matches on either name_vi or lower(name_en) — both columns hold cached
 * embeddings, so an English ingredient name like "rice" can hit a row whose
 * name_vi is "cơm" via its name_en="rice" entry without a live API call
 * (Phase C4: was a ~600 ms cliff per English ingredient).
 * On miss, fire-and-forget logs a synonym candidate for review.
 */
export async function resolveQueryEmbedding(
  ingredientName: string,
  db: PostgresJsDatabase<typeof schema>
): Promise<number[] | null> {
  if (!isEmbeddingCacheEnabled()) return null;

  const normalized = normalizeIngredientKey(ingredientName);
  const logName = normalized.slice(0, 30);

  // L1: in-memory cache — check first to short-circuit hot requests.
  const cached = memoryCache.get(normalized);
  if (cached) {
    console.info(`[embedding-cache] L1 HIT: "${logName}"`);
    return cached;
  }

  // L2: exact match on name_vi OR lower(name_en).
  // Both columns hold the cached embedding for the same row, so either match
  // returns the same vector. promoteToMemoryCache then caches under both keys.
  // Treat DB errors as cache misses — the pipeline will generate a fresh
  // embedding. Avoid kicking off the full-table warm-up here: cold requests
  // already fan out several exact lookups, and the later nutrition-cache load
  // primes the same L1 entries from the same source rows without contending on
  // the critical matching path.
  try {
    const exactRows = await db.execute(
      sql`SELECT name_vi, name_en, embedding
          FROM ingredient_query_embeddings
          WHERE name_vi = ${normalized} OR lower(name_en) = ${normalized}
          LIMIT 1`
    );

    if (exactRows.length > 0) {
      console.info(`[embedding-cache] L2 HIT: "${logName}"`);
      return promoteToMemoryCache(exactRows[0] as Record<string, unknown>);
    }
  } catch (err) {
    const cause = err instanceof Error ? (err.cause ?? err.message) : err;
    console.warn(
      `[embedding-cache] L2 lookup failed for "${normalized}", treating as miss:`,
      cause
    );
    return null;
  }

  console.info(`[embedding-cache] L1+L2 MISS: "${logName}" (will live-embed)`);

  // Miss — async: check name_en for synonym candidate logging (fire-and-forget).
  // Note: this only fires when L2 didn't match either column above, so the
  // synonym-logger now serves the residual English-with-no-DB-row case.
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
  db: PostgresJsDatabase<typeof schema>
): void {
  if (!isEmbeddingCacheEnabled()) return;

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

  if (nameVi) memoryCache.set(normalizeIngredientKey(nameVi), embedding);
  if (nameEn) memoryCache.set(normalizeIngredientKey(nameEn), embedding);

  return embedding;
}

/**
 * On cache miss, check if any row's name_en matches the query.
 * If so, log a synonym candidate for later review.
 * Entirely fire-and-forget — never blocks the caller.
 */
function logSynonymCandidateIfEnMatch(
  normalizedQuery: string,
  db: PostgresJsDatabase<typeof schema>
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
