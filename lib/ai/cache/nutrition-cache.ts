import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { parseNutritionRow } from '../matching/nutrition-db';
import type { NutritionPer100g } from '../types';

/**
 * Module-level singleton nutrition cache.
 * Holds VN FCT food composition entries (source_id = 1, ~526 rows, ~126 KB).
 * USDA rows (source_id = 2) are excluded — they are rarely matched in practice
 * and fall back to a direct DB query on a miss.
 * Lazy-loaded on first request; persists for the process lifetime.
 * Safe to hold permanently — data is read-only at runtime.
 */
const cache = new Map<string, NutritionPer100g>();

/** True only after loadAll() finishes successfully */
let initialized = false;

/** Guards against concurrent initializations on the first request burst */
let initPromise: Promise<void> | null = null;

/** @internal Exported for testing */
export function clearNutritionCache(): void {
  cache.clear();
  initialized = false;
  initPromise = null;
}

/** @internal Exported for testing */
export function getNutritionCacheStats() {
  return { size: cache.size, initialized };
}

/**
 * Return the in-memory nutrition cache, loading from DB on first call.
 *
 * Gates on an explicit `initialized` flag (not `cache.size > 0`) to avoid
 * returning a partially-loaded cache during cold-start burst.
 * On DB error the cache stays empty and callers fall back to direct queries.
 */
export async function getNutritionCache(
  db: PostgresJsDatabase<any>
): Promise<Map<string, NutritionPer100g>> {
  if (initialized) return cache;

  // Deduplicate concurrent initializations
  if (!initPromise) {
    initPromise = loadAll(db).catch((err) => {
      console.error('[nutrition-cache] Failed to load nutrition cache:', err);
      initPromise = null; // allow retry on next request
    });
  }

  await initPromise;
  return cache;
}

async function loadAll(db: PostgresJsDatabase<any>): Promise<void> {
  const rows = await db.execute(
    sql`SELECT * FROM vietnamese_food_composition WHERE source_id = 1`
  );

  for (const row of rows as unknown as Record<string, unknown>[]) {
    const id = row.id as string;
    cache.set(id, parseNutritionRow(row));
  }

  initialized = true;
  console.info(`[nutrition-cache] Loaded ${cache.size} entries`);
}
