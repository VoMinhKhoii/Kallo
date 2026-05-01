import type {
  IngredientLlmNutrition,
  MatchedIngredient,
  MealItemNutrition,
  NutritionAdjustment,
} from '../types';
import type { MealDecompositionWithIds } from './ids';

const ingredientDisplayName = (
  ing: MealDecompositionWithIds['mealItems'][number]['ingredients'][number]
): string => ing.rawName ?? ing.name ?? ing.canonicalName ?? '';

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
  // Build a per-name FIFO queue of decomposition meal items so duplicate
  // display names ("Cơm trắng" served twice) reconcile to distinct
  // `mealItemId`s in the same order Call 2 emits them. `.find()` would
  // collapse both onto the first slot and lose run-scoped id distinctness
  // required by §0.1.
  const mealItemQueueByName = new Map<
    string,
    MealDecompositionWithIds['mealItems']
  >();
  for (const mi of decomposition.mealItems) {
    const list = mealItemQueueByName.get(mi.name) ?? [];
    list.push(mi);
    mealItemQueueByName.set(mi.name, list);
  }
  const mealItemConsumed = new Map<string, number>();

  const reconciledMealItems: MealItemNutrition[] = raw.mealItems.map(
    (rawMi) => {
      const queue = mealItemQueueByName.get(rawMi.mealItemName) ?? [];
      const consumed = mealItemConsumed.get(rawMi.mealItemName) ?? 0;
      const decomposedMi = queue[consumed] ?? queue[queue.length - 1];
      if (!decomposedMi) {
        throw new Error(
          `[reconcile] Call 2 returned meal item "${rawMi.mealItemName}" not present in decomposition`
        );
      }
      mealItemConsumed.set(rawMi.mealItemName, consumed + 1);
      const totalForName = queue.length;
      if (totalForName > 1 && consumed >= totalForName) {
        console.warn(
          `[reconcile] meal item name collision: "${rawMi.mealItemName}" appears ${totalForName}x; Call 2 returned more entries than decomposition — wrapping to last slot`,
          { mealItemId: decomposedMi.mealItemId }
        );
      }

      // Per-meal-item ingredient FIFO. Same logic for duplicate raw ingredient
      // names within a single meal item.
      const ingredientQueueByName = new Map<
        string,
        (typeof decomposedMi.ingredients)[number][]
      >();
      for (const ing of decomposedMi.ingredients) {
        const name = ingredientDisplayName(ing);
        const list = ingredientQueueByName.get(name) ?? [];
        list.push(ing);
        ingredientQueueByName.set(name, list);
      }
      const ingredientConsumed = new Map<string, number>();

      const ingredients: IngredientLlmNutrition[] = rawMi.ingredients.map(
        (rawIng) => {
          const ingQueue =
            ingredientQueueByName.get(rawIng.ingredientName) ?? [];
          const ingConsumed =
            ingredientConsumed.get(rawIng.ingredientName) ?? 0;
          const decomposedIng =
            ingQueue[ingConsumed] ?? ingQueue[ingQueue.length - 1];
          if (!decomposedIng) {
            throw new Error(
              `[reconcile] Call 2 returned ingredient "${rawIng.ingredientName}" not present in meal item "${rawMi.mealItemName}"`
            );
          }
          ingredientConsumed.set(rawIng.ingredientName, ingConsumed + 1);
          const totalForIngName = ingQueue.length;
          if (totalForIngName > 1 && ingConsumed >= totalForIngName) {
            console.warn(
              `[reconcile] ingredient name collision: "${rawIng.ingredientName}" appears ${totalForIngName}x in "${rawMi.mealItemName}" — wrapping to last slot`,
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
