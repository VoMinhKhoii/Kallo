import { sql } from 'drizzle-orm';
import type { AppDb } from '@/lib/db';
import { getNutritionCache } from '../cache/nutrition-cache';
import type { NutritionPer100g } from '../types';
import { NUTRITION_SELECT_COLUMNS, parseNutritionRow } from './nutrition-db';

/**
 * Batch-fetch nutrition per 100g for a list of food composition IDs.
 *
 * Checks the in-memory nutrition cache first (loaded once per process from
 * all 526 FAO entries). Falls back to a direct DB query only for IDs that
 * are not in the cache (should not happen in practice once warm, but handles
 * cold-start race conditions gracefully).
 */
export async function batchFetchNutrition(
  ids: string[],
  db: AppDb
): Promise<Map<string, NutritionPer100g>> {
  const map = new Map<string, NutritionPer100g>();
  if (ids.length === 0) return map;

  const nutritionCache = await getNutritionCache(db);

  const missIds: string[] = [];
  for (const id of ids) {
    const cached = nutritionCache.get(id);
    if (cached) {
      map.set(id, cached);
    } else {
      missIds.push(id);
    }
  }

  if (missIds.length > 0) {
    // Cache miss — query DB directly for uncached IDs and populate cache
    const idList = sql.join(
      missIds.map((id) => sql`${id}`),
      sql`, `
    );
    const rows = await db.execute(
      sql`SELECT ${sql.raw(NUTRITION_SELECT_COLUMNS.join(', '))} FROM vietnamese_food_composition WHERE id IN (${idList})`
    );
    for (const row of rows as unknown as Record<string, unknown>[]) {
      const id = row.id as string;
      const nutrition = parseNutritionRow(row);
      map.set(id, nutrition);
      nutritionCache.set(id, nutrition);
    }
  }

  return map;
}
