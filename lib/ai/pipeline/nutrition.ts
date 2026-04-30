import type {
  IngredientLlmNutrition,
  MatchedIngredient,
  MealItemNutrition,
  NutritionAdjustment,
} from '../types';
import type { MealDecompositionWithIds } from './ids';

/**
 * Raw shape that comes out of `nutritionAdjustmentSchema.parse()` before
 * reconciliation: `ingredientId` / `mealItemId` are optional (Zod accepts
 * the LLM emitting them or omitting them; today's prompt does not request
 * them, so they are typically absent).
 */
export type RawNutritionAdjustment = {
  mealItems: Array<{
    mealItemId?: string;
    mealItemName: string;
    ingredients: Array<{
      ingredientId?: string;
      ingredientName: string;
      caloriesKcal: IngredientLlmNutrition['caloriesKcal'];
      proteinG: IngredientLlmNutrition['proteinG'];
      carbohydrateG: IngredientLlmNutrition['carbohydrateG'];
      fatG: IngredientLlmNutrition['fatG'];
    }>;
  }>;
};

/**
 * Reconcile Call 2 nutrition output with the run-scoped ids assigned by
 * `ensureIdsOnDecomposition`. Today's Call 2 prompt does not yet request
 * ids (Chunk 2 owns that prompt rewrite); the LLM emits names only.
 *
 * Strategy:
 *   1. For each meal item in the LLM result, find the matching meal item
 *      in the decomposition by `name`. On collision (two meal items with
 *      the same display name) fall back to first-match and warn — Vietnamese
 *      meals legitimately repeat names, and a hard throw would create a
 *      regression window between this chunk and Chunk 2.
 *   2. For each ingredient inside that meal item, find the corresponding
 *      `MatchedIngredient` (or `DecomposedIngredient`) by name within the
 *      same meal item's ingredient set. Same first-match-on-collision rule.
 *   3. If a name is not found at all, throw — that's a Call 2 hallucination,
 *      not a name-collision artifact.
 *
 * The function does not mutate the original; it returns a new
 * `NutritionAdjustment` whose ids are guaranteed strings.
 */
export function reconcileNutritionIds(
  raw: RawNutritionAdjustment,
  decomposition: MealDecompositionWithIds,
  matched: MatchedIngredient[]
): NutritionAdjustment {
  const mealItemNameCounts = new Map<string, number>();
  for (const mi of decomposition.mealItems) {
    mealItemNameCounts.set(mi.name, (mealItemNameCounts.get(mi.name) ?? 0) + 1);
  }

  const reconciledMealItems: MealItemNutrition[] = raw.mealItems.map(
    (rawMi) => {
      const decomposedMi = decomposition.mealItems.find(
        (mi) => mi.name === rawMi.mealItemName
      );
      if (!decomposedMi) {
        throw new Error(
          `[reconcile] Call 2 returned meal item "${rawMi.mealItemName}" not present in decomposition`
        );
      }
      const collisions = mealItemNameCounts.get(rawMi.mealItemName) ?? 0;
      if (collisions > 1) {
        console.warn(
          `[reconcile] meal item name collision: "${rawMi.mealItemName}" appears ${collisions}x; first-match used`,
          { mealItemId: decomposedMi.mealItemId }
        );
      }

      const ingredientNameCounts = new Map<string, number>();
      for (const ing of decomposedMi.ingredients) {
        ingredientNameCounts.set(
          ing.name,
          (ingredientNameCounts.get(ing.name) ?? 0) + 1
        );
      }

      const ingredients: IngredientLlmNutrition[] = rawMi.ingredients.map(
        (rawIng) => {
          const decomposedIng = decomposedMi.ingredients.find(
            (ing) => ing.name === rawIng.ingredientName
          );
          if (!decomposedIng) {
            throw new Error(
              `[reconcile] Call 2 returned ingredient "${rawIng.ingredientName}" not present in meal item "${rawMi.mealItemName}"`
            );
          }
          const ingCollisions =
            ingredientNameCounts.get(rawIng.ingredientName) ?? 0;
          if (ingCollisions > 1) {
            console.warn(
              `[reconcile] ingredient name collision: "${rawIng.ingredientName}" appears ${ingCollisions}x in "${rawMi.mealItemName}"; first-match used`,
              {
                ingredientId: decomposedIng.ingredientId,
                mealItemId: decomposedMi.mealItemId,
                matchedSimilarity: matched.find(
                  (m) => m.ingredientId === decomposedIng.ingredientId
                )?.similarity,
              }
            );
          }
          return {
            ingredientId: decomposedIng.ingredientId,
            ingredientName: rawIng.ingredientName,
            caloriesKcal: rawIng.caloriesKcal,
            proteinG: rawIng.proteinG,
            carbohydrateG: rawIng.carbohydrateG,
            fatG: rawIng.fatG,
          };
        }
      );

      return {
        mealItemId: decomposedMi.mealItemId,
        mealItemName: rawMi.mealItemName,
        ingredients,
      };
    }
  );

  return { mealItems: reconciledMealItems };
}
