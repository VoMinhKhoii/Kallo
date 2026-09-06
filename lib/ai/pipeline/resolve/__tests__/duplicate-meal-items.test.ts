/**
 * Duplicate dish names — a "log the whole day in one go" submission repeats the
 * same dish ("1 chén cơm … 1 chén cơm"), so Call 1 emits two meal items with
 * identical names and identical ingredient names. Both must keep their own
 * Call-2 estimate.
 *
 * Prod incident: the second occurrence lost its estimate, was carved out for
 * want of macro data, and — rice being a carb staple — failed the whole
 * analysis with `no_macro_data` while every stage reported success.
 */

import { describe, expect, it } from 'vitest';
import type { IngredientV2MatchResult } from '@/lib/ai/matching/retrieve/top-k-cascade';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import { bridgeV2ToV1 } from '@/lib/ai/pipeline/resolve/resolve';
import { pairIngredientsWithGrounded } from '@/lib/ai/pipeline/resolve/verdicts';

function riceEstimate(grossG: number) {
  return {
    ingredientName: 'Cơm',
    selectedCandidateId: 'c1',
    grossG,
    refusePct: 0,
    caloriesKcal: { low: 280, mid: 302, high: 330 },
    proteinG: { low: 5, mid: 6.4, high: 8 },
    carbohydrateG: { low: 60, mid: 67.8, high: 75 },
    fatG: { low: 0.2, mid: 0.6, high: 1 },
  };
}

function twoBowlsOfRice(): MealDecompositionV2 {
  const bowl = {
    name: 'cơm trắng',
    cookingMethod: 'nấu',
    ingredients: [{ rawName: 'cơm', canonicalName: 'Cơm' }],
  };
  return {
    isFood: true,
    mealSlot: 'lunch',
    mealItems: [{ ...bowl }, { ...bowl }],
  };
}

function twoBowlsGrounded(): GroundedEstimation {
  return {
    mealItems: [
      { mealItemName: 'Cơm trắng', ingredients: [riceEstimate(200)] },
      { mealItemName: 'Cơm trắng', ingredients: [riceEstimate(150)] },
    ],
  };
}

function riceMatches(): IngredientV2MatchResult[] {
  const candidate = {
    info: {
      ingredientName: 'Cơm',
      foodCompositionId: 'fc-rice',
      matchedName: 'Cơm trắng',
      similarity: 0.9,
      confidence: 'high',
      state: 'cooked',
      source: 'fao',
      matchType: 'vector',
    },
    nutrition: {
      caloriesKcal: 130,
      proteinG: 2.7,
      carbohydrateG: 28,
      fatG: 0.3,
    },
    inediblePct: null,
  };
  return [
    { ingredientIndex: 0, candidates: [candidate] },
    { ingredientIndex: 1, candidates: [candidate] },
  ] as unknown as IngredientV2MatchResult[];
}

describe('pairIngredientsWithGrounded — duplicate meal-item names', () => {
  it('gives each occurrence of a repeated dish its own estimate', () => {
    const paired = pairIngredientsWithGrounded(
      twoBowlsOfRice(),
      twoBowlsGrounded()
    );

    expect(paired).toHaveLength(2);
    expect(paired[0].ground).not.toBeNull();
    expect(paired[1].ground).not.toBeNull();
    // Distinct estimates, in order — not the same one handed out twice.
    expect(paired[0].ground?.grossG).toBe(200);
    expect(paired[1].ground?.grossG).toBe(150);
  });

  it('still consumes duplicate ingredient names within one dish in order', () => {
    const v2: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'breakfast',
      mealItems: [
        {
          name: 'trứng luộc',
          cookingMethod: 'luộc',
          ingredients: [
            { rawName: 'trứng', canonicalName: 'Trứng gà' },
            { rawName: 'trứng', canonicalName: 'Trứng gà' },
          ],
        },
      ],
    };
    const grounded: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'trứng luộc',
          ingredients: [
            { ...riceEstimate(60), ingredientName: 'trứng' },
            { ...riceEstimate(50), ingredientName: 'trứng' },
          ],
        },
      ],
    };

    const paired = pairIngredientsWithGrounded(v2, grounded);

    expect(paired[0].ground?.grossG).toBe(60);
    expect(paired[1].ground?.grossG).toBe(50);
  });
});

describe('bridgeV2ToV1 — duplicate meal-item names', () => {
  it('carves out neither bowl of rice', () => {
    const out = bridgeV2ToV1({
      v2: twoBowlsOfRice(),
      matches: riceMatches(),
      grounded: twoBowlsGrounded(),
      mealContext: '1 chén cơm + 1 chén cơm',
    });

    expect(out.carvedOut).toEqual([]);
    expect(out.verdicts.map((v) => v.verdict)).toEqual([
      'accepted',
      'accepted',
    ]);
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(200);
    expect(out.decomposition.mealItems[1].ingredients[0].grams).toBe(150);
  });
});
