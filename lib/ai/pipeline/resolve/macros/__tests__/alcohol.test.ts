import { describe, expect, it } from 'vitest';
import type { NutritionPer100g } from '@/lib/ai/types/matching';
import { alcoholKcalPer100g } from '../alcohol';
import { resolveIngredientMacros } from '../bounded-macros';
import { scalePer100g } from '../macro-base';

function row(kcal: number, p: number, c: number, f: number): NutritionPer100g {
  return {
    caloriesKcal: kcal,
    proteinG: p,
    carbohydrateG: c,
    fatG: f,
  } as NutritionPer100g;
}

// USDA "Alcoholic beverage, beer, regular, all" per 100 g.
const BEER = row(43, 0.46, 3.55, 0);
const flat = (v: number) => ({ low: v, mid: v, high: v });

describe('alcoholKcalPer100g', () => {
  it('reads the kcal gap of an alcoholic beverage row as ethanol energy', () => {
    expect(alcoholKcalPer100g(BEER, 'Beverages')).toBeCloseTo(26.96, 2);
    // FAO/VN rows use a different group name for the same thing.
    expect(alcoholKcalPer100g(row(231, 0, 0, 0), 'Beverage and liquor')).toBe(
      231
    );
  });

  it('ignores gaps outside beverage groups (vinegar, dried egg)', () => {
    expect(alcoholKcalPer100g(row(21, 0, 0.9, 0), 'Spices and Herbs')).toBe(0);
    expect(
      alcoholKcalPer100g(row(376, 77, 4.5, 0.3), 'Dairy and Egg Products')
    ).toBe(0);
    expect(alcoholKcalPer100g(BEER, undefined)).toBe(0);
  });

  it('treats a small beverage gap as rounding, not alcohol', () => {
    // Cola: 42 kcal vs 4 × 10.6 g carbs = 42.4.
    expect(alcoholKcalPer100g(row(42, 0, 10.6, 0), 'Beverages')).toBe(0);
    // Non-alcoholic malt beverage, gap ~3.
    expect(alcoholKcalPer100g(row(37, 0.2, 8, 0.1), 'Beverages')).toBe(0);
  });
});

describe('alcohol through the matched macro resolver', () => {
  it('two cans of beer keep their ethanol calories (284, not 106)', () => {
    const base = scalePer100g(BEER, 660, 'Beverages');
    const resolved = resolveIngredientMacros(
      {
        ingredientName: 'bia',
        proteinG: flat(3),
        carbohydrateG: flat(23),
        fatG: flat(0),
      },
      base,
      660
    );
    expect(resolved.caloriesKcal.mid).toBeCloseTo(283.8, 1);
    expect(resolved.caloriesKcal.low).toBeCloseTo(283.8, 1);
    expect(resolved.caloriesKcal.high).toBeCloseTo(283.8, 1);
    expect(resolved.alcoholG).toBeCloseTo(25.4, 1);
  });

  it('leaves non-alcoholic rows on the plain 4/4/9 identity', () => {
    const base = scalePer100g(row(130, 2.7, 28, 0.3), 200, 'Cereal Grains');
    const resolved = resolveIngredientMacros(
      {
        ingredientName: 'rice',
        proteinG: flat(5),
        carbohydrateG: flat(56),
        fatG: flat(0.6),
      },
      base,
      200
    );
    expect(resolved.caloriesKcal.mid).toBeCloseTo(4 * 5.4 + 4 * 56 + 9 * 0.6);
    expect(resolved.alcoholG).toBeUndefined();
  });
});
