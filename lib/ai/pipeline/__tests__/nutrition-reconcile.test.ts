import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MealDecompositionWithIds } from '../ids';
import {
  type RawNutritionAdjustment,
  reconcileNutritionIds,
} from '../nutrition';

const noopMatched = [] as never;

afterEach(() => {
  vi.restoreAllMocks();
});

function rawNutrition(
  mealItemName: string,
  ingredientName: string,
  caloriesMid = 100
): RawNutritionAdjustment {
  return {
    mealItems: [
      {
        mealItemName,
        ingredients: [
          {
            ingredientName,
            caloriesKcal: {
              low: caloriesMid - 10,
              mid: caloriesMid,
              high: caloriesMid + 10,
            },
            proteinG: { low: 1, mid: 2, high: 3 },
            carbohydrateG: { low: 1, mid: 2, high: 3 },
            fatG: { low: 0.5, mid: 1, high: 1.5 },
          },
        ],
      },
    ],
  };
}

describe('reconcileNutritionIds', () => {
  it('happy path — copies ids onto the reconciled output', () => {
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'phở bò',
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'nước dùng',
              estimatedGrams: 300,
              cookingMethod: 'luộc',
              userFacingUnit: '1 tô',
            },
          ],
        },
      ],
    };

    const out = reconcileNutritionIds(
      rawNutrition('phở bò', 'nước dùng'),
      decomposition,
      noopMatched
    );

    expect(out.mealItems[0].mealItemId).toBe('meal-A');
    expect(out.mealItems[0].ingredients[0].ingredientId).toBe('ing-1');
  });

  it('collision path — FIFO peel maps each nutrition entry to a distinct decomposition slot', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'dinner',
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'phở bò',
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'nước dùng',
              estimatedGrams: 300,
              cookingMethod: 'luộc',
              userFacingUnit: '1 tô',
            },
          ],
        },
        {
          mealItemId: 'meal-B',
          name: 'phở bò',
          ingredients: [
            {
              ingredientId: 'ing-2',
              name: 'nước dùng',
              estimatedGrams: 200,
              cookingMethod: 'luộc',
              userFacingUnit: '1 tô',
            },
          ],
        },
      ],
    };

    const out = reconcileNutritionIds(
      {
        mealItems: [
          {
            mealItemName: 'phở bò',
            ingredients: [
              {
                ingredientName: 'nước dùng',
                caloriesKcal: { low: 80, mid: 80, high: 80 },
                proteinG: { low: 8, mid: 8, high: 8 },
                carbohydrateG: { low: 6, mid: 6, high: 6 },
                fatG: { low: 2, mid: 2, high: 2 },
              },
            ],
          },
          {
            mealItemName: 'phở bò',
            ingredients: [
              {
                ingredientName: 'nước dùng',
                caloriesKcal: { low: 60, mid: 60, high: 60 },
                proteinG: { low: 6, mid: 6, high: 6 },
                carbohydrateG: { low: 4, mid: 4, high: 4 },
                fatG: { low: 1, mid: 1, high: 1 },
              },
            ],
          },
        ],
      },
      decomposition,
      noopMatched
    );

    // Two raw nutrition entries with the same name peel off in order:
    // first entry → meal-A, second entry → meal-B (NOT both → meal-A).
    expect(out.mealItems[0].mealItemId).toBe('meal-A');
    expect(out.mealItems[1].mealItemId).toBe('meal-B');
    expect(out.mealItems[0].ingredients[0].ingredientId).toBe('ing-1');
    expect(out.mealItems[1].ingredients[0].ingredientId).toBe('ing-2');
    // No warning fires when the FIFO has supply available for every demand.
    expect(warn).not.toHaveBeenCalled();
  });

  it('no-match path — throws when raw name not in decomposition', () => {
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'phở bò',
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'nước dùng',
              estimatedGrams: 300,
              cookingMethod: 'luộc',
              userFacingUnit: '1 tô',
            },
          ],
        },
      ],
    };

    expect(() =>
      reconcileNutritionIds(
        rawNutrition('bún bò Huế', 'nước dùng'),
        decomposition,
        noopMatched
      )
    ).toThrow(/not present in decomposition/);
  });
});
