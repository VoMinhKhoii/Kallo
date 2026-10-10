import {
  fetchInediblePctForIds,
  getInedibleCache,
  isNutritionCacheInitialized,
} from '@/lib/ai/cache/nutrition-cache';
import type { MatchInfo } from '@/lib/ai/matching/match-constants';
import { batchFetchNutrition } from '@/lib/ai/matching/nutrition-batch';
import type { NutritionPer100g } from '@/lib/ai/types/matching';
import type { AppDb } from '@/lib/infra/db/client';

/**
 * What every matcher hands the pipeline: per ingredient, the candidates Call 2
 * chooses from (best first), with their nutrition attached.
 */
export interface IngredientV2MatchResult {
  ingredientIndex: number;
  candidates: V2MatchCandidate[];
}

export interface V2MatchCandidate {
  info: MatchInfo;
  nutrition: NutritionPer100g | null;
  inediblePct: number | null;
  /**
   * How Call 2 sees this candidate, owned by the matcher that produced it:
   * the legacy matcher shows the row's names and its similarity; card
   * retrieval shows the card label and a rank score (its order is the signal).
   */
  prompt: { name: string; nameEn: string | null; score: number };
}

/**
 * Batch-fetch nutrition + inedible pct for all unique candidate ids and
 * attach them to the candidates in place (the last step of every matcher).
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
