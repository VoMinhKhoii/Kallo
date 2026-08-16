/** Meal builders + a fake estimator, shared by the chunk-policy and chunked-call2 tests. */

import type {
  GroundedEstimator,
  GroundedEstimatorInput,
  GroundedEstimatorResult,
} from '@/lib/ai/pipeline/estimator/types';
import type { MealItemWithCandidates } from '@/lib/ai/prompts/grounded-estimation';

/** A meal item with `ingredientCount` ingredients — grams anchors filled. */
export function item(
  name: string,
  ingredientCount: number
): MealItemWithCandidates {
  return {
    mealItem: {
      name,
      cookingMethod: 'luộc',
      ingredients: Array.from({ length: ingredientCount }, (_, i) => ({
        rawName: `${name}-ing${i + 1}`,
        canonicalName: `${name}-ing${i + 1}`,
      })),
    },
    ingredients: Array.from({ length: ingredientCount }, (_, i) => ({
      ingredient: {
        rawName: `${name}-ing${i + 1}`,
        canonicalName: `${name}-ing${i + 1}`,
      },
      candidates: [],
      resolvedGramsAnchor: 100,
    })),
  };
}

export function meal(
  itemCount: number,
  ingredientsPerItem: number
): MealItemWithCandidates[] {
  return Array.from({ length: itemCount }, (_, i) =>
    item(`dish${i + 1}`, ingredientsPerItem)
  );
}

/**
 * A fake estimator echoing a grounded meal item per input meal item. `fail`
 * lets a test force a hard chunk failure; `delayMs` simulates latency for
 * deadline tests.
 */
export function fakeEstimator(opts?: {
  failFor?: (mealItemName: string) => boolean;
  delayMs?: number;
  onCall?: (input: GroundedEstimatorInput) => void;
}): GroundedEstimator {
  return {
    id: 'fake',
    model: 'fake-model',
    async estimate(
      input: GroundedEstimatorInput
    ): Promise<GroundedEstimatorResult> {
      opts?.onCall?.(input);
      if (opts?.delayMs) {
        await new Promise((r) => setTimeout(r, opts.delayMs));
      }
      if (
        opts?.failFor &&
        input.mealItems.some((mi) => opts.failFor!(mi.mealItem.name))
      ) {
        throw new Error('forced chunk failure');
      }
      return {
        estimation: {
          mealItems: input.mealItems.map((mi) => ({
            mealItemName: mi.mealItem.name,
            ingredients: mi.ingredients.map((ing) => ({
              ingredientName: ing.ingredient.rawName,
              grossG: 100,
              refusePct: 0,
              caloriesKcal: { low: 100, mid: 110, high: 120 },
              proteinG: { low: 10, mid: 11, high: 12 },
              carbohydrateG: { low: 5, mid: 6, high: 7 },
              fatG: { low: 1, mid: 1, high: 1 },
            })),
          })),
        },
      };
    },
  };
}

export const baseArgs = {
  originalPrompt: 'x',
  userContext: {
    countryOfOrigin: 'Vietnam',
    countryOfResidence: 'Vietnam',
    inputLanguage: 'vi' as const,
    outputLanguage: 'vi' as const,
    cookingHabits: {
      oilUsage: 'normal' as const,
      defaultRicePortion: 'medium' as const,
      defaultProteinPortion: 'medium' as const,
      sugarBraised: 'medium' as const,
      brothConsumption: 'some' as const,
    },
  },
  temperature: 0.4,
  phaseDeadlineMs: 40_000,
};
