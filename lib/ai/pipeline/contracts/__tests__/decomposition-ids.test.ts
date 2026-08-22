import { describe, expect, it } from 'vitest';
import {
  ensureIdsOnDecomposition,
  generateIngredientId,
  generateMealItemId,
} from '@/lib/ai/pipeline/contracts/decomposition-ids';
import { mealDecompositionSchema } from '@/lib/ai/pipeline/contracts/schemas/decomposition';

describe('id generators', () => {
  it('generates compact run-scoped fallback ids', () => {
    expect(generateMealItemId()).toBe('m1');
    expect(generateIngredientId()).toBe('i1');
  });
});

describe('ensureIdsOnDecomposition', () => {
  it('fills missing ids and de-duplicates collisions with compact ids', () => {
    const decomp = {
      isFood: true,
      mealSlot: 'lunch' as const,
      mealItems: [
        {
          name: 'phở bò',
          mealItemId: 'shared',
          ingredients: [
            {
              name: 'bánh phở',
              estimatedGrams: 200,
              cookingMethod: 'luộc',
              userFacingUnit: '1 tô',
              ingredientId: 'dup',
            },
            {
              name: 'thịt bò',
              estimatedGrams: 100,
              cookingMethod: 'luộc',
              userFacingUnit: '3 lát',
              ingredientId: 'dup',
            },
          ],
        },
        {
          name: 'rau sống',
          mealItemId: 'shared',
          ingredients: [
            {
              name: 'rau quế',
              estimatedGrams: 20,
              cookingMethod: null,
              userFacingUnit: null,
              ingredientId: '',
            },
          ],
        },
      ],
    };
    const out = ensureIdsOnDecomposition(decomp);
    const itemIds = out.mealItems.map((m) => m.mealItemId);
    expect(itemIds).toEqual(['m1', 'm2']);
    expect(new Set(itemIds).size).toBe(itemIds.length);
    const ingIds = out.mealItems.flatMap((m) =>
      m.ingredients.map((i) => i.ingredientId)
    );
    expect(ingIds).toEqual(['i1', 'i2', 'i3']);
    expect(new Set(ingIds).size).toBe(ingIds.length);
  });

  it('preserves unique compact IDs and normalizes legacy UUIDs', () => {
    const out = ensureIdsOnDecomposition({
      isFood: true,
      mealSlot: null,
      mealItems: [
        {
          name: 'rice',
          mealItemId: 'm7',
          ingredients: [
            {
              name: 'rice',
              estimatedGrams: 200,
              cookingMethod: null,
              userFacingUnit: null,
              ingredientId: '11111111-1111-4111-8111-111111111111',
            },
          ],
        },
      ],
    });

    expect(out.mealItems[0].mealItemId).toBe('m7');
    expect(out.mealItems[0].ingredients[0].ingredientId).toBe('i1');
  });
});

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
  it('assigns a unique compact ID to every meal item and ingredient', () => {
    const parsed = mealDecompositionSchema.parse(RAW_CALL_1_OUTPUT);
    const filled = ensureIdsOnDecomposition(parsed);

    const mealIds = filled.mealItems.map((m) => m.mealItemId);
    expect(mealIds).toEqual(['m1', 'm2']);
    expect(new Set(mealIds).size).toBe(mealIds.length);

    const ingredientIds = filled.mealItems.flatMap((m) =>
      m.ingredients.map((i) => i.ingredientId)
    );
    expect(ingredientIds).toEqual(['i1', 'i2', 'i3', 'i4']);
    expect(new Set(ingredientIds).size).toBe(ingredientIds.length);

    const nuocDungIds = filled.mealItems
      .flatMap((m) => m.ingredients)
      .filter((i) => i.rawName === 'nước dùng')
      .map((i) => i.ingredientId);
    expect(nuocDungIds.length).toBe(2);
    expect(nuocDungIds[0]).not.toBe(nuocDungIds[1]);
  });
});
