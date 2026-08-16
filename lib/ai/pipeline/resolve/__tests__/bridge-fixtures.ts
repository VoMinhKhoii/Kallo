/**
 * Shared v2 fixtures for the bridge tests.
 *
 * `resolve.test.ts` (the translation) and `completeness-gate.test.ts` (the
 * persist/fail decision over its carve-outs) both drive `bridgeV2ToV1` with
 * the same one-ingredient grilled-chicken meal, so the fixtures live here
 * rather than being duplicated in each file.
 */

import { NULL_NUTRITION_VALUES } from '@/lib/ai/__tests__/test-helpers';
import type { IngredientV2MatchResult } from '@/lib/ai/matching/top-k-cascade';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';

export function v2Decomp(): MealDecompositionV2 {
  return {
    isFood: true,
    mealSlot: 'lunch',
    mealItems: [
      {
        name: 'đùi gà nướng',
        cookingMethod: 'nướng',
        ingredients: [
          {
            rawName: 'đùi gà',
            canonicalName: 'Đùi gà',
            prepNotes: ['bỏ da', 'bỏ mỡ'],
          },
        ],
      },
    ],
  };
}

export function matchResultWithCandidate(): IngredientV2MatchResult[] {
  return [
    {
      ingredientIndex: 0,
      candidates: [
        {
          info: {
            ingredientName: 'đùi gà',
            foodCompositionId: 'fc-thigh',
            matchedName: 'Đùi gà',
            similarity: 0.92,
            confidence: 'high',
            state: 'cooked',
            source: 'fao',
            matchType: 'vector',
          },
          nutrition: {
            ...NULL_NUTRITION_VALUES,
            caloriesKcal: 220,
            proteinG: 24,
            carbohydrateG: 0,
            fatG: 14,
          },
          inediblePct: null,
        },
      ],
    },
  ];
}

export function groundedAccepted(): GroundedEstimation {
  return {
    mealItems: [
      {
        mealItemName: 'đùi gà nướng',
        ingredients: [
          {
            ingredientName: 'đùi gà',
            selectedCandidateId: 'c1',
            grossG: 150,
            refusePct: 0,
            caloriesKcal: { low: 270, mid: 290, high: 310 },
            proteinG: { low: 38, mid: 40, high: 42 },
            carbohydrateG: { low: 0, mid: 0, high: 0 },
            fatG: { low: 10, mid: 12, high: 14 },
          },
        ],
      },
    ],
  };
}

export function nullNutritionMatch(): IngredientV2MatchResult[] {
  // Accepted candidate whose Phase-5 batch nutrition fetch missed.
  return [
    {
      ingredientIndex: 0,
      candidates: [
        {
          info: {
            state: 'raw',
            source: 'fao',
            matchType: 'fuzzy',
            confidence: 'high',
            similarity: 1,
            foodGroupEn: 'Cereals',
            matchedName: 'Bún tươi',
            ingredientName: 'Bún tươi',
            foodCompositionId: 'fao_x_raw',
          },
          nutrition: null,
          inediblePct: null,
        },
      ],
    },
  ] as unknown as IngredientV2MatchResult[];
}
