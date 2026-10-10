import {
  fetchNutritionForIds,
  isNutritionCacheInitialized,
  peekFoodGroupCache,
  peekNutritionCache,
  warmNutritionCacheInBackground,
} from '@/lib/ai/cache/nutrition-cache';
import type { NutritionPer100g } from '@/lib/ai/types/matching';
import type { AppDb } from '@/lib/infra/db/client';

export interface MatchedFoodData extends NutritionPer100g {
  foodGroupEn?: string;
}

/**
 * Batch-fetch nutrition per 100g for a list of food composition IDs.
 *
 * Hot path (cache warm): reads every id from the in-memory nutrition cache,
 * with a direct query only for the residual misses (e.g. USDA rows the VN-FCT
 * warm never loaded).
 *
 * Cold path (cache not yet warm): does NOT block on the full-table load.
 * Instead it reads whatever is already in the singleton, queries only the
 * handful of candidate IDs this meal needs directly, then kicks the full warm
 * off in the background. Starting the warm after the foreground query is
 * deliberate: v2 also fetches inedible data in parallel, and starting all
 * three queries together can starve the default two-connection pool.
 */
export async function batchFetchNutrition(
  ids: string[],
  db: AppDb
): Promise<Map<string, MatchedFoodData>> {
  const map = new Map<string, MatchedFoodData>();
  if (ids.length === 0) return map;

  const shouldWarmInBackground = !isNutritionCacheInitialized();

  const nutritionCache = peekNutritionCache();
  const foodGroupCache = peekFoodGroupCache();
  const missIds: string[] = [];
  for (const id of ids) {
    const cached = nutritionCache.get(id);
    if (cached) {
      map.set(id, {
        ...cached,
        ...(foodGroupCache.has(id)
          ? { foodGroupEn: foodGroupCache.get(id) }
          : {}),
      });
    } else {
      missIds.push(id);
    }
  }

  if (missIds.length > 0) {
    const fetched = await fetchNutritionForIds(missIds, db);
    for (const [id, nutrition] of fetched) {
      map.set(id, {
        ...nutrition,
        ...(foodGroupCache.has(id)
          ? { foodGroupEn: foodGroupCache.get(id) }
          : {}),
      });
    }
  }

  // The meal-critical ID query has released its connection. Only now start
  // the best-effort full-table warm so it cannot jump ahead of foreground
  // matching work in postgres.js's queue.
  if (shouldWarmInBackground) {
    warmNutritionCacheInBackground(db);
  }

  return map;
}
