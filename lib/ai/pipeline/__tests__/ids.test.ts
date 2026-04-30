import { describe, expect, it } from 'vitest';
import {
  ensureIdsOnDecomposition,
  generateIngredientId,
  generateMealItemId,
} from '../ids';

describe('id generators', () => {
  it('generates UUID-shaped strings', () => {
    expect(generateMealItemId()).toMatch(/^[0-9a-f-]{36}$/i);
    expect(generateIngredientId()).toMatch(/^[0-9a-f-]{36}$/i);
  });
  it('generates unique ids', () => {
    const a = new Set(Array.from({ length: 100 }, generateIngredientId));
    expect(a.size).toBe(100);
  });
});

describe('ensureIdsOnDecomposition', () => {
  it('fills missing ids and de-duplicates collisions', () => {
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
    expect(new Set(itemIds).size).toBe(itemIds.length);
    const ingIds = out.mealItems.flatMap((m) =>
      m.ingredients.map((i) => i.ingredientId)
    );
    expect(new Set(ingIds).size).toBe(ingIds.length);
    for (const id of [...itemIds, ...ingIds]) {
      expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    }
  });
});
