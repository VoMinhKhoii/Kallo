import { describe, expect, it } from 'vitest';
import {
  ensureIdsOnDecomposition,
  generateIngredientId,
  generateMealItemId,
} from '../ids';

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
