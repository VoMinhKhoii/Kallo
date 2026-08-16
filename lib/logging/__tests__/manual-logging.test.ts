import { describe, expect, it } from 'vitest';
import type { NutritionValues } from '@/lib/ai/types/nutrition-values';
import { NUTRITION_KEYS } from '@/lib/ai/types/nutrition-values';
import {
  createEmptyRow,
  hasCompleteRow,
  type IngredientSearchResult,
  type ManualMealRow,
  parseGrams,
  rowIsComplete,
  rowLabel,
  rowMacros,
  scaleNutritionValues,
  totalsForRows,
} from '@/lib/logging/manual-logging';

const rice: IngredientSearchResult = {
  id: 'fct-rice',
  namePrimary: 'Cơm trắng',
  nameEn: 'White rice',
  nameAlt: null,
  state: 'cooked',
  similarity: 0.9,
  per100g: { caloriesKcal: 130, proteinG: 2.7, carbohydrateG: 28, fatG: null },
};

function row(grams: string, ingredient = rice): ManualMealRow {
  return { id: 'row-1', query: '', ingredient, grams };
}

describe('rowLabel', () => {
  it('prefers the raw typed text, falling back to the picked name', () => {
    expect(
      rowLabel({ id: 'x', query: 'ức gà', ingredient: rice, grams: '1' })
    ).toBe('ức gà');
    // Empty query (e.g. tapped a recent) → the ingredient name.
    expect(
      rowLabel({ id: 'x', query: '  ', ingredient: rice, grams: '1' })
    ).toBe('Cơm trắng');
    expect(rowLabel(createEmptyRow('x'))).toBe('');
  });
});

describe('parseGrams', () => {
  it('parses plain and comma-decimal values', () => {
    expect(parseGrams('150')).toBe(150);
    expect(parseGrams('12,5')).toBe(12.5);
    expect(parseGrams(' 80.5 ')).toBe(80.5);
  });

  it('rejects empty, zero, negative, and garbage input', () => {
    expect(parseGrams('')).toBeNull();
    expect(parseGrams('0')).toBeNull();
    expect(parseGrams('-5')).toBeNull();
    expect(parseGrams('abc')).toBeNull();
  });
});

describe('rowIsComplete / hasCompleteRow', () => {
  it('requires both an ingredient and parseable grams', () => {
    expect(rowIsComplete(createEmptyRow('x'))).toBe(false);
    expect(rowIsComplete(row(''))).toBe(false);
    expect(
      rowIsComplete({ id: 'x', query: '', ingredient: null, grams: '100' })
    ).toBe(false);
    expect(rowIsComplete(row('100'))).toBe(true);
    expect(hasCompleteRow([createEmptyRow('x'), row('100')])).toBe(true);
  });
});

describe('rowMacros', () => {
  it('scales per-100g macros by grams/100, preserving nulls', () => {
    const macros = rowMacros(row('150'));
    expect(macros?.caloriesKcal).toBeCloseTo(195);
    expect(macros?.proteinG).toBeCloseTo(4.05);
    expect(macros?.carbohydrateG).toBeCloseTo(42);
    expect(macros?.fatG).toBeNull();
  });

  it('returns null for incomplete rows', () => {
    expect(rowMacros(createEmptyRow('x'))).toBeNull();
    expect(rowMacros(row('not-a-number'))).toBeNull();
  });
});

describe('totalsForRows', () => {
  it('sums complete rows and skips incomplete ones', () => {
    const chicken: IngredientSearchResult = {
      ...rice,
      id: 'fct-chicken',
      per100g: { caloriesKcal: 200, proteinG: 20, carbohydrateG: 0, fatG: 13 },
    };
    const totals = totalsForRows([
      row('100'),
      { id: 'row-2', query: '', ingredient: chicken, grams: '50' },
      createEmptyRow('row-3'),
    ]);
    expect(totals.caloriesKcal).toBeCloseTo(130 + 100);
    expect(totals.proteinG).toBeCloseTo(2.7 + 10);
    // fat known only for chicken — known values still sum.
    expect(totals.fatG).toBeCloseTo(6.5);
  });

  it('returns all-null totals when no row is complete', () => {
    expect(totalsForRows([createEmptyRow('x')])).toEqual({
      caloriesKcal: null,
      proteinG: null,
      carbohydrateG: null,
      fatG: null,
    });
  });
});

describe('scaleNutritionValues', () => {
  it('scales all 28 nutrients and keeps nulls null', () => {
    const per100g = Object.fromEntries(
      NUTRITION_KEYS.map((key) => [key, null])
    ) as unknown as NutritionValues;
    per100g.caloriesKcal = 130;
    per100g.sodiumMg = 1;

    const scaled = scaleNutritionValues(per100g, 150);
    expect(scaled.caloriesKcal).toBeCloseTo(195);
    expect(scaled.sodiumMg).toBeCloseTo(1.5);
    for (const key of NUTRITION_KEYS) {
      if (key === 'caloriesKcal' || key === 'sodiumMg') continue;
      expect(scaled[key]).toBeNull();
    }
  });
});
