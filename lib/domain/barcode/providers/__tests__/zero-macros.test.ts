import { describe, expect, it } from 'vitest';
import type { BarcodeProductRecord } from '@/lib/domain/barcode/types';
import { fillZeroMacros } from '../zero-macros';

function product(
  overrides: Partial<BarcodeProductRecord> = {}
): BarcodeProductRecord {
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
    amountUnit: 'ml',
    micronutrients: {},
    sourceImageUrl: null,
    ...overrides,
  };
}

describe('fillZeroMacros', () => {
  it('zeroes the macros a carbs-only drink never listed', () => {
    const tea = product({ caloriesKcal: 34, carbohydrateG: 8.6 });
    expect(fillZeroMacros(tea)).toMatchObject({
      proteinG: 0,
      carbohydrateG: 8.6,
      fatG: 0,
    });
  });

  it('zeroes every macro of a zero-calorie product', () => {
    expect(fillZeroMacros(product({ caloriesKcal: 0 }))).toMatchObject({
      proteinG: 0,
      carbohydrateG: 0,
      fatG: 0,
    });
  });

  it('keeps a blank when the listed macros leave energy unexplained', () => {
    // Beer: 43 kcal, 3.6g carbs — the rest is alcohol, which no macro lists.
    const beer = product({ caloriesKcal: 43, carbohydrateG: 3.6 });
    expect(fillZeroMacros(beer)).toBe(beer);
  });

  it('keeps a blank fat line the energy says is real', () => {
    // 4·7.5 + 4·52 = 238 of 350 kcal; ~12g of fat is missing, not zero.
    const noodles = product({
      caloriesKcal: 350,
      proteinG: 7.5,
      carbohydrateG: 52,
    });
    expect(fillZeroMacros(noodles).fatG).toBeNull();
  });

  it('keeps a blank when the listed macros exceed the stated energy', () => {
    // 0 kcal beside 10g of carbs contradicts itself; it is no proof of zero,
    // and filling it would let the label pass as complete.
    const contradictory = product({ caloriesKcal: 0, carbohydrateG: 10 });
    expect(fillZeroMacros(contradictory)).toBe(contradictory);
  });

  it('keeps blanks a dense label leaves room for', () => {
    // 50g fat is 450 of 500 kcal: the 50 left is 5g protein + 7.5g carbs as
    // easily as rounding. A share-of-label tolerance (10%) would call it zero.
    const dense = product({ caloriesKcal: 500, fatG: 50 });
    expect(fillZeroMacros(dense)).toBe(dense);
  });

  it('never zeroes carbohydrate a listed fiber proves is there', () => {
    // 10g protein explains 40 kcal, but 5g fiber is carbohydrate by itself.
    const fibrous = product({ caloriesKcal: 40, proteinG: 10, fiberG: 5 });
    expect(fillZeroMacros(fibrous)).toBe(fibrous);
  });

  it('reads energy within rounding as explained', () => {
    // 4·1 + 4·10 = 44 against 48 kcal: under the 5 kcal floor.
    const filled = fillZeroMacros(
      product({ caloriesKcal: 48, proteinG: 1, carbohydrateG: 10 })
    );
    expect(filled.fatG).toBe(0);
  });

  it('does not count fiber as energy', () => {
    // 10g carbs of which 8g fiber delivers ~8 kcal, not 40 — 30 kcal unexplained.
    const fibrous = product({
      caloriesKcal: 38,
      carbohydrateG: 10,
      fiberG: 8,
    });
    expect(fillZeroMacros(fibrous).proteinG).toBeNull();
  });

  it('leaves a product with no calories or no gaps untouched', () => {
    const noKcal = product({ carbohydrateG: 5 });
    const complete = product({
      caloriesKcal: 100,
      proteinG: 5,
      carbohydrateG: 10,
      fatG: 4,
    });
    expect(fillZeroMacros(noKcal)).toBe(noKcal);
    expect(fillZeroMacros(complete)).toBe(complete);
  });
});
