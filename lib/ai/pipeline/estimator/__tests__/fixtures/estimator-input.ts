/** One grounded ingredient in, one golden Call-2 estimation out — shared by the adapter tests. */

import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { GroundedEstimatorInput } from '@/lib/ai/pipeline/estimator/types';
import type { MealItemWithCandidates } from '@/lib/ai/prompts/grounded-estimation';

export const mealItems: MealItemWithCandidates[] = [
  {
    mealItem: {
      name: 'ức gà luộc',
      cookingMethod: 'luộc',
      ingredients: [{ rawName: 'ức gà', canonicalName: 'Ức gà' }],
    },
    ingredients: [
      {
        ingredient: { rawName: 'ức gà', canonicalName: 'Ức gà' },
        candidates: [
          {
            id: 'c1',
            similarity: 1,
            dbName: 'Ức gà',
            dbState: 'cooked',
            source: 'fao',
            per100gKcal: 165,
            per100gProteinG: 31,
            per100gCarbohydrateG: 0,
            per100gFatG: 3.6,
            inediblePct: 0,
          },
        ],
        resolvedGramsAnchor: 150,
      },
    ],
  },
];

export const input: GroundedEstimatorInput = {
  originalPrompt: '150g ức gà luộc',
  mealItems,
  userContext: {
    countryOfOrigin: 'Vietnam',
    countryOfResidence: 'Vietnam',
    inputLanguage: 'vi',
    outputLanguage: 'vi',
    cookingHabits: {
      oilUsage: 'normal',
      defaultRicePortion: 'medium',
      defaultProteinPortion: 'medium',
      sugarBraised: 'medium',
      brothConsumption: 'some',
    },
  },
  temperature: 0.4,
};

export const CALL2: GroundedEstimation = {
  mealItems: [
    {
      mealItemName: 'ức gà luộc',
      ingredients: [
        {
          ingredientName: 'ức gà',
          selectedCandidateId: 'c1',
          grossG: 150,
          refusePct: 0,
          caloriesKcal: { low: 240, mid: 250, high: 260 },
          proteinG: { low: 44, mid: 46, high: 48 },
          carbohydrateG: { low: 0, mid: 0, high: 0 },
          fatG: { low: 5, mid: 5.4, high: 6 },
        },
      ],
    },
  ],
};
