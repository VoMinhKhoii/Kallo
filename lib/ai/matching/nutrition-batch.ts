import type { AppDb } from '@/lib/db';
import {
  fetchNutritionForIds,
  isNutritionCacheInitialized,
  peekNutritionCache,
  warmNutritionCacheInBackground,
} from '../cache/nutrition-cache';
import type { NutritionPer100g } from '../types';

/**
 * Batch-fetch nutrition per 100g for a list of food composition IDs.
 *
 * Hot path (cache warm): reads every id from the in-memory nutrition cache,
 * with a direct query only for the residual misses (e.g. USDA rows the VN-FCT
 * warm never loaded).
 *
 * Cold path (cache not yet warm): does NOT block on the full-table load.
 * Instead it reads whatever is already in the singleton, queries only the
 * handful of candidate IDs this meal needs directly, and kicks the full warm
 * off in the background so subsequent requests are hot. This keeps the cold
 * matching critical path off the multi-MB cross-region table load.
 */
export async function batchFetchNutrition(
  ids: string[],
  db: AppDb
): Promise<Map<string, NutritionPer100g>> {
  const map = new Map<string, NutritionPer100g>();
  if (ids.length === 0) return map;

  if (!isNutritionCacheInitialized()) {
    // Cold: warm in the background, resolve this meal's IDs directly.
    warmNutritionCacheInBackground(db);
  }

  const nutritionCache = peekNutritionCache();
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
    const fetched = await fetchNutritionForIds(missIds, db);
    for (const [id, nutrition] of fetched) map.set(id, nutrition);
  }

  return map;
}
