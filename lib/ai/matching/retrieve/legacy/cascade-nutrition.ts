import type { MatchInfo } from '@/lib/ai/matching/match-constants';
import {
  batchFetchNutrition,
  type MatchedFoodData,
} from '@/lib/ai/matching/retrieve/nutrition-batch';
import type {
  MatchedIngredient,
  UnmatchedIngredient,
} from '@/lib/ai/types/matching';
import type { AppDb } from '@/lib/db';

/**
 * Phases 4–5 of the v1 cascade: one batched nutrition query for every matched
 * id, then the join back into `MatchedIngredient`.
 *
 * A match whose nutrition row is missing is demoted to unmatched rather than
 * emitted with empty macros. The single retry covers transient DB errors
 * (connection hiccups, timeouts); a second failure degrades the whole batch to
 * unmatched instead of failing the run.
 */
export async function attachNutrition(args: {
  matchInfos: MatchInfo[];
  matched: MatchedIngredient[];
  unmatched: UnmatchedIngredient[];
  mealContext: string;
  db: AppDb;
}): Promise<void> {
  const { matchInfos, matched, unmatched, mealContext, db } = args;
  const uniqueIds = [...new Set(matchInfos.map((m) => m.foodCompositionId))];
  let nutritionMap: Map<string, MatchedFoodData>;
  try {
    nutritionMap = await batchFetchNutrition(uniqueIds, db);
  } catch (err) {
    console.warn('[matching] batchFetchNutrition failed, retrying once:', err);
    try {
      nutritionMap = await batchFetchNutrition(uniqueIds, db);
    } catch (retryErr) {
      console.error(
        '[matching] batchFetchNutrition retry also failed:',
        retryErr
      );
      nutritionMap = new Map();
    }
  }

  for (const info of matchInfos) {
    const foodData = nutritionMap.get(info.foodCompositionId);
    if (foodData) {
      const { state, ingredientId, ...rest } = info;
      matched.push({
        ...rest,
        ingredientId,
        nutritionPer100g: foodData,
        ...(foodData.foodGroupEn ? { foodGroupEn: foodData.foodGroupEn } : {}),
        dbState: state,
      });
    } else {
      console.warn(
        `[matching] No nutrition data for matched ID "${info.foodCompositionId}" (${info.ingredientName})`
      );
      unmatched.push({
        ingredientName: info.ingredientName,
        mealContext,
      });
    }
  }
}
