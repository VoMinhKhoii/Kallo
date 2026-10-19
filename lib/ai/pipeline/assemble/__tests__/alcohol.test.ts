import { describe, expect, it } from 'vitest';
import { NULL_NUTRITION_VALUES } from '@/lib/ai/__fixtures__/test-helpers';
import type { IngredientV2MatchResult } from '@/lib/ai/matching/candidate';
import { assembleResult } from '@/lib/ai/pipeline/assemble/assemble';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import { reconcileNutritionIds } from '@/lib/ai/pipeline/resolve/macro-resolution';
import { bridgeV2ToV1 } from '@/lib/ai/pipeline/resolve/resolve';
import type { UserContext } from '@/lib/ai/types/user-context';

// The prod report: "2 lon bia" showed ~106 kcal instead of 284, because kcal
// was rebuilt from 4P + 4C + 9F and beer's energy is mostly ethanol.

const userContext: UserContext = {
  goal: 'maintaining',
  aggression: 0,
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  inputLanguage: 'vi',
  outputLanguage: 'vi',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    defaultProteinPortion: 'medium',
    brothConsumption: 'some',
  },
};

const decomposition: MealDecompositionV2 = {
  isFood: true,
  mealSlot: 'dinner',
  mealItems: [
    {
      name: 'bia',
      cookingMethod: 'none',
      ingredients: [{ rawName: 'bia', canonicalName: 'Bia' }],
    },
  ],
};

function beerMatch(foodGroupEn: string | undefined): IngredientV2MatchResult {
  return {
    ingredientIndex: 0,
    candidates: [
      {
        info: {
          ingredientName: 'bia',
          foodCompositionId: 'usda-14003',
          matchedName: 'Alcoholic beverage, beer, regular, all',
          similarity: 0.9,
          confidence: 'high',
          state: 'cooked',
          source: 'usda',
          ...(foodGroupEn ? { foodGroupEn } : {}),
        },
        nutrition: {
          ...NULL_NUTRITION_VALUES,
          caloriesKcal: 43,
          proteinG: 0.46,
          carbohydrateG: 3.55,
          fatG: 0,
        },
        inediblePct: 0,
        prompt: { name: 'Bia', nameEn: null, score: 0.9 },
      },
    ],
  };
}

const grounded: GroundedEstimation = {
  mealItems: [
    {
      mealItemName: 'bia',
      ingredients: [
        {
          ingredientName: 'bia',
          selectedCandidateId: 'c1',
          grossG: 660,
          refuseKind: 'none',
          refusePct: 0,
          proteinG: { low: 3, mid: 3, high: 3 },
          carbohydrateG: { low: 23.4, mid: 23.4, high: 23.4 },
          fatG: { low: 0, mid: 0, high: 0 },
        },
      ],
    },
  ],
};

function assemble(match: IngredientV2MatchResult) {
  const bridged = bridgeV2ToV1({
    v2: decomposition,
    matches: [match],
    grounded,
    mealContext: '2 lon bia',
    portionResolutions: [],
  });
  const reconciled = reconcileNutritionIds(
    bridged.rawNutrition,
    bridged.decomposition,
    bridged.matched
  );
  return assembleResult(
    bridged.decomposition,
    reconciled,
    bridged.matched,
    bridged.unmatched,
    userContext
  ).result;
}

describe('alcohol energy in the assembled meal', () => {
  it('two cans of beer total ~284 kcal and carry their ethanol grams', () => {
    const result = assemble(beerMatch('Beverages'));
    const beer = result.mealItems[0].ingredients[0];
    expect(result.displayedNutrition.caloriesKcal).toBeCloseTo(283.8, 0);
    expect(beer.alcoholG).toBeCloseTo(25.4, 1);
  });

  it('without a food group the row stays on the 4/4/9 identity', () => {
    const result = assemble(beerMatch(undefined));
    expect(result.displayedNutrition.caloriesKcal).toBeCloseTo(105.9, 0);
    expect(result.mealItems[0].ingredients[0].alcoholG).toBeUndefined();
  });
});
