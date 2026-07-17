import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '@/lib/db/schema';
import {
  NUTRITION_CACHE_SELECT_COLUMNS,
  parseNutritionRow,
} from '../matching/nutrition-db';
import type { NutritionPer100g } from '../types';

/**
 * Module-level singleton nutrition cache.
 * Lazy-loaded on first request; persists for the process lifetime.
 * Safe to hold permanently — data is read-only at runtime.
 *
 * `cache` is seeded from VN FCT (source_id=1, ~526 rows) by `loadAll`, and may
 * additionally accumulate USDA (source_id=2) rows when `batchFetchNutrition`
 * backfills on a miss.
 *
 * `inedibleCache` is strictly VN-FCT — populated only from the same `loadAll`
 * pass, never widened on miss. Absence in the map means "no inedible data" by
 * design (USDA imports leave `inedible_portion_pct` NULL).
 *
 * `loadAll` selects only the nutrition + inedible columns (see
 * `NUTRITION_CACHE_SELECT_COLUMNS`) — NOT the 768-dim embedding vector — so the
 * warm-up is a small ~126 KB load rather than the several-MB `SELECT *` that
 * blocked the cold matching path.
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

/** True once the bulk warm has completed — lets callers pick the cold path. */
export function isNutritionCacheInitialized(): boolean {
  return initialized;
}

/**
 * Return the in-memory nutrition cache WITHOUT triggering the bulk warm.
 * Callers on the cold matching path use this to read whatever is already
 * loaded, then query only their handful of candidate IDs directly instead of
 * awaiting the full-table load. Always the live singleton map (empty on cold).
 */
export function peekNutritionCache(): Map<string, NutritionPer100g> {
  return cache;
}

/** Insert a directly-fetched row into the singleton so later hits are warm. */
export function primeNutritionEntry(
  id: string,
  nutrition: NutritionPer100g
): void {
  cache.set(id, nutrition);
}

/**
 * Kick off the bulk warm without awaiting it. Safe to call on every request:
 * `ensureInitialized` dedupes to a single in-flight load. Errors are swallowed
 * by `ensureInitialized`; the returned promise never rejects.
 */
export function warmNutritionCacheInBackground(
  db: PostgresJsDatabase<typeof schema>
): void {
  void ensureInitialized(db);
}

/**
 * Cold-path direct fetch: query nutrition for a specific set of candidate IDs
 * (the ones this meal actually needs) instead of awaiting the full-table warm.
 * Rows are also promoted into the singleton so repeat hits stay warm.
 */
export async function fetchNutritionForIds(
  ids: string[],
  db: PostgresJsDatabase<typeof schema>
): Promise<Map<string, NutritionPer100g>> {
  const map = new Map<string, NutritionPer100g>();
  if (ids.length === 0) return map;

  const idList = sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `
  );
  const rows = await db.execute(
    sql`SELECT ${sql.raw(NUTRITION_CACHE_SELECT_COLUMNS.join(', '))} FROM vietnamese_food_composition WHERE id IN (${idList})`
  );
  for (const row of rows as unknown as Record<string, unknown>[]) {
    const id = row.id as string;
    const nutrition = parseNutritionRow(row);
    map.set(id, nutrition);
    cache.set(id, nutrition);
    const inedible = row.inedible_portion_pct;
    if (inedible != null) {
      const parsed = Number(inedible);
      if (Number.isFinite(parsed)) inedibleCache.set(id, parsed);
    }
  }
  return map;
}

/**
 * Cold-path inedible-pct fetch for a specific set of candidate IDs. Mirrors
 * `fetchNutritionForIds` but returns only the inedible map (VN-FCT rows only —
 * USDA rows leave the column NULL and are absent by design). Rows are promoted
 * into the inedible singleton so later hits are warm.
 */
export async function fetchInediblePctForIds(
  ids: string[],
  db: PostgresJsDatabase<typeof schema>
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;

  const idList = sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `
  );
  const rows = await db.execute(
    sql`SELECT id, inedible_portion_pct FROM vietnamese_food_composition WHERE id IN (${idList})`
  );
  for (const row of rows as unknown as Record<string, unknown>[]) {
    const id = row.id as string;
    const inedible = row.inedible_portion_pct;
    if (inedible == null) continue;
    const parsed = Number(inedible);
    if (!Number.isFinite(parsed)) continue;
    map.set(id, parsed);
    inedibleCache.set(id, parsed);
  }
  return map;
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
    sql`SELECT ${sql.raw(NUTRITION_CACHE_SELECT_COLUMNS.join(', '))} FROM vietnamese_food_composition WHERE source_id = 1`
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

  initialized = true;
  console.info(
    `[nutrition-cache] Loaded ${cache.size} entries (${inedibleCache.size} with inedible_portion_pct)`
  );
}
