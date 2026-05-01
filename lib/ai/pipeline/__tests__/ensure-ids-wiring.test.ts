import { describe, expect, it } from 'vitest';
import { ensureIdsOnDecomposition } from '@/lib/ai/pipeline/ids';
import { mealDecompositionSchema } from '@/lib/ai/pipeline/schemas';

const RAW_CALL_1_OUTPUT = {
  isFood: true,
  mealSlot: 'dinner',
  mealItems: [
    {
      mealItemId: 'not-a-uuid-meal-1',
      name: 'phở bò',
      cookingMethod: 'luộc',
      ingredients: [
        {
          ingredientId: 'not-a-uuid-ing-1',
          rawName: 'nước dùng',
          canonicalName: 'Nước dùng',
          grams: 300,
          expectedState: 'cooked',
        },
        {
          ingredientId: 'not-a-uuid-ing-2',
          rawName: 'bánh phở',
          canonicalName: 'Bánh phở',
          grams: 180,
          expectedState: 'cooked',
        },
      ],
    },
    {
      mealItemId: 'not-a-uuid-meal-2',
      name: 'bún bò Huế',
      cookingMethod: 'luộc',
      ingredients: [
        {
          ingredientId: 'not-a-uuid-ing-3',
          rawName: 'nước dùng',
          canonicalName: 'Nước dùng',
          grams: 280,
          expectedState: 'cooked',
        },
        {
          ingredientId: 'not-a-uuid-ing-4',
          rawName: 'bún',
          canonicalName: 'Bún',
          grams: 200,
          expectedState: 'cooked',
        },
      ],
    },
  ],
};

describe('ensureIdsOnDecomposition at the Call 1 parse boundary', () => {
  it('assigns a unique UUID to every meal item and ingredient', () => {
    const parsed = mealDecompositionSchema.parse(RAW_CALL_1_OUTPUT);
    const filled = ensureIdsOnDecomposition(parsed);

    const mealIds = filled.mealItems.map((m) => m.mealItemId);
    expect(new Set(mealIds).size).toBe(mealIds.length);
    for (const id of mealIds) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    }

    const ingredientIds = filled.mealItems.flatMap((m) =>
      m.ingredients.map((i) => i.ingredientId)
    );
    expect(new Set(ingredientIds).size).toBe(ingredientIds.length);
    for (const id of ingredientIds) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    }

    const nuocDungIds = filled.mealItems
      .flatMap((m) => m.ingredients)
      .filter((i) => i.rawName === 'nước dùng')
      .map((i) => i.ingredientId);
    expect(nuocDungIds.length).toBe(2);
    expect(nuocDungIds[0]).not.toBe(nuocDungIds[1]);
  });
});
