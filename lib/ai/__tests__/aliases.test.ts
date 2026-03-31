import { describe, expect, it } from 'vitest';
import {
  applyIngredientAliases,
  INGREDIENT_ALIASES,
  resolveAlias,
} from '../aliases';
import type { MealDecomposition } from '../types';

describe('resolveAlias', () => {
  it('returns canonical name for known aliases', () => {
    expect(resolveAlias('cơm')).toBe('Gạo tẻ');
    expect(resolveAlias('ba chỉ')).toBe('Thịt lợn ba chỉ');
    expect(resolveAlias('trứng')).toBe('Trứng gà');
    expect(resolveAlias('tôm')).toBe('Tôm sú');
  });

  it('is case-insensitive', () => {
    expect(resolveAlias('Cơm')).toBe('Gạo tẻ');
    expect(resolveAlias('BA CHỈ')).toBe('Thịt lợn ba chỉ');
    expect(resolveAlias('TRỨNG')).toBe('Trứng gà');
  });

  it('trims whitespace', () => {
    expect(resolveAlias('  cơm  ')).toBe('Gạo tẻ');
    expect(resolveAlias('\ttrứng\n')).toBe('Trứng gà');
  });

  it('returns original name when no alias exists', () => {
    expect(resolveAlias('Thịt lợn ba chỉ')).toBe('Thịt lợn ba chỉ');
    expect(resolveAlias('some unknown ingredient')).toBe(
      'some unknown ingredient'
    );
  });

  it('handles empty string', () => {
    expect(resolveAlias('')).toBe('');
  });
});

describe('applyIngredientAliases', () => {
  it('resolves aliases for all ingredients in place', () => {
    const decomposition: MealDecomposition = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'Cơm thịt kho trứng',
          ingredients: [
            {
              name: 'Cơm',
              estimatedGrams: 200,
              cookingMethod: 'nấu',
              userFacingUnit: '1 chén',
            },
            {
              name: 'Ba chỉ',
              estimatedGrams: 120,
              cookingMethod: 'kho',
              userFacingUnit: null,
            },
            {
              name: 'Trứng',
              estimatedGrams: 50,
              cookingMethod: 'kho',
              userFacingUnit: '1 quả',
            },
          ],
        },
      ],
    };

    applyIngredientAliases(decomposition);

    expect(decomposition.mealItems[0].ingredients[0].name).toBe('Gạo tẻ');
    expect(decomposition.mealItems[0].ingredients[1].name).toBe(
      'Thịt lợn ba chỉ'
    );
    expect(decomposition.mealItems[0].ingredients[2].name).toBe('Trứng gà');
  });

  it('preserves names that have no alias', () => {
    const decomposition: MealDecomposition = {
      isFood: true,
      mealSlot: null,
      mealItems: [
        {
          name: 'Phở bò',
          ingredients: [
            {
              name: 'Bánh phở',
              estimatedGrams: 200,
              cookingMethod: 'luộc',
              userFacingUnit: null,
            },
          ],
        },
      ],
    };

    applyIngredientAliases(decomposition);

    expect(decomposition.mealItems[0].ingredients[0].name).toBe('Bánh phở');
  });

  it('handles empty meal items', () => {
    const decomposition: MealDecomposition = {
      isFood: true,
      mealSlot: null,
      mealItems: [],
    };

    // Should not throw
    applyIngredientAliases(decomposition);
    expect(decomposition.mealItems).toHaveLength(0);
  });
});

describe('INGREDIENT_ALIASES', () => {
  it('has all keys lowercased', () => {
    for (const key of Object.keys(INGREDIENT_ALIASES)) {
      expect(key).toBe(key.toLowerCase());
    }
  });

  it('has non-empty canonical names', () => {
    for (const [_key, value] of Object.entries(INGREDIENT_ALIASES)) {
      expect(value.length).toBeGreaterThan(0);
      // Canonical names should be capitalized
      expect(value[0]).toBe(value[0].toUpperCase());
    }
  });
});
