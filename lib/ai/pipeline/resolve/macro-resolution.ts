import type { MealDecompositionWithIds } from '@/lib/ai/pipeline/contracts/decomposition-ids';
import type { MatchedIngredient } from '@/lib/ai/types/matching';
import type {
  IngredientLlmNutrition,
  MacroBase,
  MealItemNutrition,
  NutritionAdjustment,
} from '@/lib/ai/types/nutrition-adjustment';
import type { BoundedEstimate } from '@/lib/ai/types/nutrition-values';
import { mealItemHasDiscreteOil } from '@/lib/nutrition/absorbed-oil';
import { resolveIngredientMacros } from './macros/bounded-macros';
import { computeMacroBaseMap } from './macros/macro-base';

export { __testing } from './macros/bounded-macros';
export {
  computeDbScalingGrams,
  computeMacroBaseMap,
} from './macros/macro-base';

import {
  ingredientDisplayName,
  ingredientGrams,
} from '@/lib/ai/pipeline/contracts/ingredient-accessors';

/**
 * Raw shape that comes out of `nutritionAdjustmentSchema.parse()` before
 * reconciliation: `ingredientId` / `mealItemId` are optional (today's prompt
 * does not request them). Macros are absolute `{low, mid, high}` triples.
 */
export type RawNutritionAdjustment = {
  mealItems: Array<{
    mealItemId?: string;
    mealItemName: string;
    ingredients: Array<{
      ingredientId?: string;
      ingredientName: string;
      caloriesKcal: BoundedEstimate;
      proteinG: BoundedEstimate;
      carbohydrateG: BoundedEstimate;
      fatG: BoundedEstimate;
    }>;
  }>;
};

/**
 * Default cooking-adjustment ratio for fat when no `prepNotes` are present.
 * Realistic frying-in-oil roughly doubles fat; 3× is the outer envelope.
 * Protein and carb are server-anchored in this path, so the guard fires
 * only on fat.
 */
export function resolveStreamingMealItem(
  rawItem: RawNutritionAdjustment['mealItems'][number],
  decomposedMealItem: MealDecompositionWithIds['mealItems'][number] | undefined,
  baseMap: Map<string, MacroBase>
): MealItemNutrition {
  // Whether this dish carries its frying fat as its own row. Computed once per
  // meal item: if it does, its sibling foods must not also be granted an
  // absorbed-oil allowance, or the oil lands in the total twice.
  const siblingOilPresent = mealItemHasDiscreteOil(
    rawItem.ingredients.map((ing) => ing.ingredientName)
  );
  const ingredients: IngredientLlmNutrition[] = rawItem.ingredients.map(
    (rawIng) => {
      const decIng = decomposedMealItem?.ingredients.find(
        (ing) => ingredientDisplayName(ing) === rawIng.ingredientName
      );
      const ingredientId = decIng?.ingredientId ?? '';
      const base = ingredientId ? baseMap.get(ingredientId) : undefined;
      const grams = decIng ? ingredientGrams(decIng) : undefined;
      if (!base && (typeof grams !== 'number' || grams <= 0)) {
        // No matched base AND no grams to drive the unmatched density clamp.
        // The streaming preview will pass the LLM triple through unclamped.
        // The authoritative `reconcileNutritionIds` runs after the full stream
        // completes and re-resolves with the FIFO-matched decomposition entry,
        // so persisted data is unaffected — only the live SSE preview is.
        console.warn(
          `[nutrition] streaming_unmatched_no_grams: density clamp skipped for "${rawIng.ingredientName}" in "${rawItem.mealItemName}" (no decomposition match yet)`
        );
      }
      const prepNotesPresent = hasPrepNotes(decIng?.prepNotes);
      const resolved = resolveIngredientMacros(
        rawIng,
        base,
        grams,
        prepNotesPresent,
        decIng?.cookingMethod ?? decomposedMealItem?.cookingMethod ?? null,
        decIng?.prepNotes,
        siblingOilPresent
      );
      return {
        ingredientId,
        ingredientName: rawIng.ingredientName,
        ...resolved,
      };
    }
  );

  return {
    mealItemId: decomposedMealItem?.mealItemId,
    mealItemName: rawItem.mealItemName,
    ingredients,
  };
}

/** True iff the ingredient carries at least one non-empty prepNote. */
function hasPrepNotes(notes: string[] | undefined): boolean {
  if (!notes || notes.length === 0) return false;
  return notes.some((n) => typeof n === 'string' && n.trim().length > 0);
}

/**
 * Reconcile Call 2 nutrition output with the run-scoped ids assigned by
 * `ensureIdsOnDecomposition`, resolving macros against the base map in the
 * same pass.
 *
 * Strategy:
 *   1. Match meal items by name (FIFO queue for duplicate display names).
 *   2. Match ingredients by name within the meal item (same FIFO policy).
 *   3. For each matched ingredient with a DB-anchored base:
 *      - protein and carb are flat triples at the DB-anchored value (LLM ignored);
 *      - fat keeps the LLM triple subject to the 3× hallucination guard plus
 *        the cooking method's additive oil allowance; outliers are clamped;
 *      - calories are derived from the macro identity (4P + 4C + 9F), so
 *        only fat's spread (when present) drives kcal's spread.
 *   4. For unmatched ingredients:
 *      - protein, carb, fat come from the LLM verbatim (no DB anchor);
 *      - calories are derived from 4P + 4C + 9F (structural identity);
 *      - if kcal.mid / grams × 100 > `UNMATCHED_DENSITY_CEILING`, all four
 *        macros are scaled down proportionally so the triple stays under the
 *        physical ceiling.
 */
export function reconcileNutritionIds(
  raw: RawNutritionAdjustment,
  decomposition: MealDecompositionWithIds,
  matched: MatchedIngredient[]
): NutritionAdjustment {
  const baseMap = computeMacroBaseMap(decomposition, matched);

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
      // See `resolveStreamingMealItem`: one discrete oil row per meal item
      // suppresses its siblings' absorbed-oil allowance.
      const siblingOilPresent = mealItemHasDiscreteOil(
        rawMi.ingredients.map((ing) => ing.ingredientName)
      );

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
          const ingredientId = decomposedIng.ingredientId;
          const base = baseMap.get(ingredientId);
          const grams = ingredientGrams(decomposedIng);
          const prepNotesPresent = hasPrepNotes(decomposedIng.prepNotes);
          const resolved = resolveIngredientMacros(
            rawIng,
            base,
            grams,
            prepNotesPresent,
            decomposedIng.cookingMethod ?? decomposedMi.cookingMethod ?? null,
            decomposedIng.prepNotes,
            siblingOilPresent
          );
          return {
            ingredientId,
            ingredientName: rawIng.ingredientName,
            ...resolved,
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

// Internal export for tests that want to assert on individual helpers.
