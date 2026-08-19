import { afterEach, describe, expect, it, vi } from 'vitest';
import { NULL_NUTRITION_VALUES } from '@/lib/ai/__fixtures__/test-helpers';
import type { MealDecompositionWithIds } from '@/lib/ai/pipeline/contracts/decomposition-ids';
import {
  type RawNutritionAdjustment,
  reconcileNutritionIds,
} from '@/lib/ai/pipeline/resolve/macro-resolution';
import type { MatchedIngredient } from '@/lib/ai/types/matching';

afterEach(() => {
  vi.restoreAllMocks();
});

const noNutrition = NULL_NUTRITION_VALUES;

describe('resolveIngredientMacros — prepNotesPresent unlocks P/C', () => {
  function rawAdj(p: number, c: number, f: number): RawNutritionAdjustment {
    return {
      mealItems: [
        {
          mealItemName: 'đùi gà nướng',
          ingredients: [
            {
              ingredientName: 'đùi gà',
              caloriesKcal: { low: 0, mid: 0, high: 0 },
              proteinG: { low: p, mid: p, high: p },
              carbohydrateG: { low: c, mid: c, high: c },
              fatG: { low: f, mid: f, high: f },
            },
          ],
        },
      ],
    };
  }

  const decompositionFactory = (
    prepNotes?: string[]
  ): MealDecompositionWithIds => ({
    isFood: true,
    mealSlot: 'lunch',
    mealItems: [
      {
        mealItemId: 'm1',
        name: 'đùi gà nướng',
        cookingMethod: 'nướng',
        ingredients: [
          {
            ingredientId: 'i1',
            name: 'đùi gà',
            estimatedGrams: 100,
            userFacingUnit: null,
            prepNotes,
          },
        ],
      },
    ],
  });

  const matched: MatchedIngredient[] = [
    {
      ingredientId: 'i1',
      ingredientName: 'đùi gà',
      foodCompositionId: 'fc-thigh',
      matchedName: 'Đùi gà',
      similarity: 0.9,
      confidence: 'high',
      dbState: 'cooked',
      nutritionPer100g: {
        ...noNutrition,
        caloriesKcal: 220,
        proteinG: 18,
        carbohydrateG: 0,
        fatG: 14,
      },
    },
  ];

  it('without prepNotes: P/C are flat at base (LLM ignored)', () => {
    const out = reconcileNutritionIds(
      rawAdj(99, 99, 7), // LLM tries to spike protein
      decompositionFactory(undefined),
      matched
    );
    const ing = out.mealItems[0].ingredients[0];
    // base.proteinG = 18 × 100/100 = 18 → flat triple
    expect(ing.proteinG.low).toBeCloseTo(18, 3);
    expect(ing.proteinG.mid).toBeCloseTo(18, 3);
    expect(ing.proteinG.high).toBeCloseTo(18, 3);
  });

  it('with prepNotes: P moves under the 1.4× cap', () => {
    const out = reconcileNutritionIds(
      rawAdj(22, 0, 7), // 22/18 ≈ 1.22× — within band
      decompositionFactory(['bỏ da', 'bỏ mỡ']),
      matched
    );
    const ing = out.mealItems[0].ingredients[0];
    expect(ing.proteinG.mid).toBeCloseTo(22, 3);
    // fat 7/14 = 0.5× — at lower bound (allowed)
    expect(ing.fatG.mid).toBeCloseTo(7, 3);
  });

  it('with prepNotes: P clamps when beyond 1.4× cap (overshoot)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = reconcileNutritionIds(
      rawAdj(30, 0, 7), // 30/18 ≈ 1.67× — beyond cap
      decompositionFactory(['bỏ da', 'bỏ mỡ']),
      matched
    );
    const ing = out.mealItems[0].ingredients[0];
    expect(ing.proteinG.mid).toBeCloseTo(25.2, 3); // clamped to 1.4× base
  });

  it('empty prepNotes array is equivalent to no prep notes', () => {
    const out = reconcileNutritionIds(
      rawAdj(99, 99, 7),
      decompositionFactory([]),
      matched
    );
    const ing = out.mealItems[0].ingredients[0];
    expect(ing.proteinG.mid).toBeCloseTo(18, 3); // still flat at base
  });

  it('prepNotes with only whitespace is treated as empty', () => {
    const out = reconcileNutritionIds(
      rawAdj(99, 99, 7),
      decompositionFactory(['   ', '']),
      matched
    );
    const ing = out.mealItems[0].ingredients[0];
    expect(ing.proteinG.mid).toBeCloseTo(18, 3);
  });
});
