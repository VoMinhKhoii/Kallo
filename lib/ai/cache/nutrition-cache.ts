import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '@/lib/db/schema';
import { primeEmbeddingCacheFromRows } from '../matching/embedding-cache';
import { parseNutritionRow } from '../matching/nutrition-db';
import type { NutritionPer100g } from '../types';

/**
 * Module-level singleton nutrition cache.
 * Lazy-loaded on first request; persists for the process lifetime.
 * Safe to hold permanently — data is read-only at runtime.
 *
 * `cache` is seeded from VN FCT (source_id=1, ~526 rows, ~126 KB) by
 * `loadAll`, and may additionally accumulate USDA (source_id=2) rows when
 * `batchFetchNutrition` backfills on a miss.
 *
 * `inedibleCache` is strictly VN-FCT — populated only from the same
 * `loadAll` pass, never widened on miss. Absence in the map means "no
 * inedible data" by design (USDA imports leave `inedible_portion_pct` NULL).
 */
const cache = new Map<string, NutritionPer100g>();
const inedibleCache = new Map<string, number>();

/** True only after loadAll() finishes successfully */
let initialized = false;

/** Guards against concurrent initializations on the first request burst */
let initPromise: Promise<void> | null = null;

/** @internal Exported for testing */
export function clearNutritionCache(): void {
  cache.clear();
  inedibleCache.clear();
  initialized = false;
  initPromise = null;
}

/** @internal Exported for testing */
export function getNutritionCacheStats() {
  return {
    size: cache.size,
    inedibleSize: inedibleCache.size,
    initialized,
  };
}

/**
 * Return the in-memory nutrition cache, loading from DB on first call.
 *
 * Gates on an explicit `initialized` flag (not `cache.size > 0`) to avoid
 * returning a partially-loaded cache during cold-start burst.
 * On DB error the cache stays empty and callers fall back to direct queries.
 */
export async function getNutritionCache(
  db: PostgresJsDatabase<typeof schema>
): Promise<Map<string, NutritionPer100g>> {
  await ensureInitialized(db);
  return cache;
}

/**
 * Return the in-memory inedible-portion-pct cache, sharing initialization
 * with `getNutritionCache` so callers that need both pay one DB load.
 *
 * Only ids with a numeric `inedible_portion_pct` land in the map — absent
 * rows are deliberately missing so callers can treat `.get(id) === undefined`
 * as "no inedible data".
 */
export async function getInedibleCache(
  db: PostgresJsDatabase<typeof schema>
): Promise<Map<string, number>> {
  await ensureInitialized(db);
  return inedibleCache;
}

async function ensureInitialized(
  db: PostgresJsDatabase<typeof schema>
): Promise<void> {
  if (initialized) return;
  if (!initPromise) {
    initPromise = loadAll(db).catch((err) => {
      console.error('[nutrition-cache] Failed to load nutrition cache:', err);
      // Same reset semantics as the test helper: drop both maps and re-arm
      // `initPromise` so the next caller can retry.
      clearNutritionCache();
    });
  }
  await initPromise;
}

async function loadAll(db: PostgresJsDatabase<typeof schema>): Promise<void> {
  const rows = await db.execute(
    sql`SELECT * FROM vietnamese_food_composition WHERE source_id = 1`
  );
  const allRows = rows as unknown as Record<string, unknown>[];

  for (const row of allRows) {
    const id = row.id as string;
    cache.set(id, parseNutritionRow(row));
    // Postgres `numeric` columns arrive as strings from postgres-js, but tests
    // pass numbers; `Number()` normalizes both. Skip NaN (null/missing/junk).
    const inedible = row.inedible_portion_pct;
    if (inedible != null) {
      const parsed = Number(inedible);
      if (Number.isFinite(parsed)) inedibleCache.set(id, parsed);
    }
  }

  // Same SELECT * already pulled `embedding` + `name_primary` + `name_en`,
  // so prime the embedding L1 cache here too instead of running a second
  // identical query from `warmEmbeddingCache`.
  primeEmbeddingCacheFromRows(allRows);

  initialized = true;
  console.info(
    `[nutrition-cache] Loaded ${cache.size} entries (${inedibleCache.size} with inedible_portion_pct)`
  );
}
