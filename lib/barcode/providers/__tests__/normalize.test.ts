import { describe, expect, it } from 'vitest';
import type { ParsedBarcodeProduct } from '@/lib/barcode/openfoodfacts';
import {
  hasUsableNutrition,
  isNutritionComplete,
  isPlausiblePer100g,
  normalizeGtin,
  nutritionCompleteness,
  parseNumber,
  parseSizeGrams,
  reconcileEnergy,
  sodiumMgFromGrams,
} from '../normalize';

function product(
  overrides: Partial<ParsedBarcodeProduct> = {}
): ParsedBarcodeProduct {
  return {
    barcode: '8934563138162',
    name: 'Test product',
    brand: null,
    caloriesKcal: null,
    proteinG: null,
    carbohydrateG: null,
    fatG: null,
    fiberG: null,
    sodiumMg: null,
    servingSizeG: null,
    packageSizeG: null,
    ...overrides,
  };
}

describe('parseNumber', () => {
  it('treats blank strings as missing, never as zero', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('   ')).toBeNull();
  });

  it('parses numeric strings and numbers, rejecting garbage', () => {
    expect(parseNumber('12.5')).toBe(12.5);
    expect(parseNumber(0)).toBe(0);
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
    expect(parseNumber(null)).toBeNull();
  });
});

describe('parseSizeGrams', () => {
  it('rejects non-positive and over-cap sizes', () => {
    expect(parseSizeGrams(0)).toBeNull();
    expect(parseSizeGrams(-30)).toBeNull();
    expect(parseSizeGrams(100_001)).toBeNull();
  });

  it('accepts plausible sizes, including the cap itself', () => {
    expect(parseSizeGrams('75')).toBe(75);
    expect(parseSizeGrams(100_000)).toBe(100_000);
  });
});

describe('reconcileEnergy', () => {
  it('derives kcal from kJ when kcal is missing', () => {
    expect(reconcileEnergy(null, 418.4)).toBe(100);
  });

  it('overrides a garbage kcal with the kJ-derived value', () => {
    // Real OFF data for Ensure (8710428998392): a bogus 3.27 kcal next to a
    // correct 1718.8 kJ (≈ 411 kcal).
    expect(reconcileEnergy(3.27, 1718.8)).toBe(411);
  });

  it('keeps a stated kcal that agrees with kJ within tolerance', () => {
    expect(reconcileEnergy(250, 1046)).toBe(250);
    // ~10% apart — inside the ±25% band, so the stated value stands.
    expect(reconcileEnergy(225, 1046)).toBe(225);
  });

  it('returns the stated kcal when no kJ is available', () => {
    expect(reconcileEnergy(120, null)).toBe(120);
    expect(reconcileEnergy(null, null)).toBeNull();
  });
});

describe('sodiumMgFromGrams', () => {
  it('converts grams of sodium to mg', () => {
    expect(sodiumMgFromGrams(0.25, null)).toBe(250);
  });

  it('falls back to salt / 2.5 when sodium is absent', () => {
    expect(sodiumMgFromGrams(null, 2.5)).toBe(1000);
  });

  it('is null when neither is stated', () => {
    expect(sodiumMgFromGrams(null, null)).toBeNull();
  });
});

describe('normalizeGtin', () => {
  it('makes zero-padded and unpadded spellings compare equal', () => {
    expect(normalizeGtin('0049000050103')).toBe(normalizeGtin('049000050103'));
    expect(normalizeGtin('00000049000050103')).toBe('49000050103');
  });

  it('strips non-digits and accepts numeric input', () => {
    expect(normalizeGtin(' 04-9000 ')).toBe('49000');
    expect(normalizeGtin(49_000)).toBe('49000');
  });

  it('is null for empty, all-zero, and non-string input', () => {
    expect(normalizeGtin('0000000000000')).toBeNull();
    expect(normalizeGtin('')).toBeNull();
    expect(normalizeGtin(null)).toBeNull();
    expect(normalizeGtin(undefined)).toBeNull();
  });
});

describe('isPlausiblePer100g', () => {
  it('accepts an ordinary label', () => {
    expect(
      isPlausiblePer100g(
        product({
          caloriesKcal: 350,
          proteinG: 7.5,
          carbohydrateG: 52,
          fatG: 12,
        })
      )
    ).toBe(true);
  });

  it('accepts pure fat at the macro and energy ceilings', () => {
    expect(
      isPlausiblePer100g(
        product({
          caloriesKcal: 900,
          proteinG: 0,
          carbohydrateG: 0,
          fatG: 100,
        })
      )
    ).toBe(true);
  });

  it('rejects energy no food can carry per 100 g', () => {
    expect(isPlausiblePer100g(product({ caloriesKcal: 1500 }))).toBe(false);
  });

  it('rejects a macro exceeding the 100 g basis', () => {
    expect(isPlausiblePer100g(product({ carbohydrateG: 250 }))).toBe(false);
  });

  it('rejects macros whose Atwater energy overshoots the stated calories', () => {
    // Per-serving macros (240 g bottle) next to per-100g calories.
    expect(
      isPlausiblePer100g(
        product({
          caloriesKcal: 40,
          proteinG: 8,
          carbohydrateG: 30,
          fatG: 5,
        })
      )
    ).toBe(false);
  });

  it('accepts an Atwater undershoot (alcohol carries unattributed energy)', () => {
    expect(
      isPlausiblePer100g(
        product({
          caloriesKcal: 43,
          proteinG: 0.5,
          carbohydrateG: 3.6,
          fatG: 0,
        })
      )
    ).toBe(true);
  });

  it('skips the Atwater check when a macro is missing', () => {
    expect(
      isPlausiblePer100g(product({ caloriesKcal: 400, proteinG: 5 }))
    ).toBe(true);
  });
});

describe('hasUsableNutrition', () => {
  it('is false for a barcode match with no nutrition at all', () => {
    expect(hasUsableNutrition(product())).toBe(false);
  });

  it('is true for kJ-derived calories', () => {
    expect(
      hasUsableNutrition(
        product({ caloriesKcal: reconcileEnergy(null, 418.4) })
      )
    ).toBe(true);
  });

  it('is true for a zero-calorie product', () => {
    expect(hasUsableNutrition(product({ caloriesKcal: 0 }))).toBe(true);
  });

  it('is false when macros exist but calories do not', () => {
    expect(hasUsableNutrition(product({ proteinG: 5, fatG: 2 }))).toBe(false);
  });
});

describe('nutritionCompleteness', () => {
  it('counts populated nutrition fields and orders candidates', () => {
    const kcalOnly = product({ caloriesKcal: 350 });
    const full = product({
      caloriesKcal: 350,
      proteinG: 7.5,
      carbohydrateG: 52,
      fatG: 12,
      fiberG: 2,
      sodiumMg: 850,
    });

    expect(nutritionCompleteness(product())).toBe(0);
    expect(nutritionCompleteness(kcalOnly)).toBe(1);
    expect(nutritionCompleteness(full)).toBe(6);
    expect(nutritionCompleteness(full)).toBeGreaterThan(
      nutritionCompleteness(kcalOnly)
    );
  });

  it('ignores non-nutrition fields', () => {
    expect(
      nutritionCompleteness(product({ servingSizeG: 75, packageSizeG: 150 }))
    ).toBe(0);
  });
});

describe('isNutritionComplete', () => {
  it('needs calories plus two of protein/carb/fat', () => {
    expect(isNutritionComplete(product({ caloriesKcal: 350 }))).toBe(false);
    expect(
      isNutritionComplete(product({ caloriesKcal: 350, proteinG: 7.5 }))
    ).toBe(false);
    expect(
      isNutritionComplete(
        product({ caloriesKcal: 350, proteinG: 7.5, fatG: 12 })
      )
    ).toBe(true);
  });

  it('is false without calories however many macros are present', () => {
    expect(
      isNutritionComplete(
        product({ proteinG: 7.5, carbohydrateG: 52, fatG: 12 })
      )
    ).toBe(false);
  });

  it('does not count fiber or sodium as macros', () => {
    expect(
      isNutritionComplete(
        product({ caloriesKcal: 350, fiberG: 2, sodiumMg: 850 })
      )
    ).toBe(false);
  });
});
