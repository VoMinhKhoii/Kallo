import {
  fetchInediblePctForIds,
  getInedibleCache,
  isNutritionCacheInitialized,
} from '@/lib/ai/cache/nutrition-cache';
import { batchFetchNutrition } from '@/lib/ai/matching/retrieve/nutrition-batch';
// Type-only import — erased at compile time, so this is not a runtime cycle.
import type { IngredientV2MatchResult } from '@/lib/ai/matching/retrieve/top-k-cascade';
import type { AppDb } from '@/lib/infra/db';

/**
 * Phase 5 of the v2 cascade: batch-fetch nutrition + inedible pct for all
 * unique candidate ids and attach them to the candidates in place.
 *
 * USDA rows are intentionally not back-filled: `inedible_portion_pct` is
 * VN-FCT–specific and USDA imports leave it NULL, so they stay `null` by
 * design rather than paying a roundtrip that returns nothing.
 */
export async function attachCandidateNutrition(
  results: IngredientV2MatchResult[],
  db: AppDb
): Promise<void> {
  const uniqueIds = new Set<string>();
  for (const r of results) {
    for (const c of r.candidates) uniqueIds.add(c.info.foodCompositionId);
  }
  if (uniqueIds.size === 0) return;

  const ids = Array.from(uniqueIds);
  // Inedible pct: on a warm cache read the full in-memory map; on cold DON'T
  // block on the full-table load (`getInedibleCache` would) — query only this
  // meal's candidate IDs directly. `batchFetchNutrition` already kicked the
  // background warm, so subsequent requests read the warm map.
  const inediblePromise = isNutritionCacheInitialized()
    ? getInedibleCache(db)
    : fetchInediblePctForIds(ids, db);
  const [nutritionMap, inedibleMap] = await Promise.all([
    batchFetchNutrition(ids, db),
    inediblePromise,
  ]);
  for (const r of results) {
    for (const c of r.candidates) {
      const id = c.info.foodCompositionId;
      const foodData = nutritionMap.get(id);
      c.nutrition = foodData ?? null;
      if (foodData?.foodGroupEn) c.info.foodGroupEn = foodData.foodGroupEn;
      c.inediblePct = inedibleMap.get(id) ?? null;
    }
  }
}
