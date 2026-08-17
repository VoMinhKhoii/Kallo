import { describe, expect, it } from 'vitest';
import {
  availableAmountModes,
  clampGrams,
  clampServings,
  MAX_GRAMS,
  MAX_SERVINGS,
  resolveGrams,
  scalePer100,
} from '@/lib/domain/barcode/amount';

describe('clampGrams', () => {
  it('keeps an in-range amount untouched', () => {
    expect(clampGrams(250)).toBe(250);
  });

  it('floors at 1g so a cleared input never stages a zero-gram meal', () => {
    expect(clampGrams(0)).toBe(1);
    expect(clampGrams(-40)).toBe(1);
  });

  it('caps at the shared max so a large package is clipped, not truncated', () => {
    expect(clampGrams(MAX_GRAMS + 1)).toBe(MAX_GRAMS);
  });
});

describe('clampServings', () => {
  it('keeps servings between 1 and the max', () => {
    expect(clampServings(3)).toBe(3);
    expect(clampServings(0)).toBe(1);
    expect(clampServings(MAX_SERVINGS + 10)).toBe(MAX_SERVINGS);
  });
});

describe('scalePer100', () => {
  it('returns null for a nutrient the product does not report', () => {
    expect(scalePer100(null, 250, 1)).toBeNull();
  });

  it('rounds calories to whole numbers', () => {
    expect(scalePer100(123, 250, 0)).toBe(308);
  });

  it('rounds macros to one decimal', () => {
    expect(scalePer100(7.3, 250, 1)).toBe(18.3);
  });
});

describe('availableAmountModes', () => {
  it('offers serving, package and grams in that priority order', () => {
    expect(
      availableAmountModes({ servingSizeG: 30, packageSizeG: 300 })
    ).toEqual(['serving', 'package', 'grams']);
  });

  it('drops the sizing modes the product has no numbers for', () => {
    expect(
      availableAmountModes({ servingSizeG: null, packageSizeG: 300 })
    ).toEqual(['package', 'grams']);
    expect(
      availableAmountModes({ servingSizeG: null, packageSizeG: null })
    ).toEqual(['grams']);
  });
});

describe('resolveGrams', () => {
  const sizes = { servingSizeG: 32.5, packageSizeG: 300.4 };

  it('multiplies servings by the serving size, rounded', () => {
    expect(
      resolveGrams('serving', { servings: 3, customGrams: 100, ...sizes })
    ).toBe(98);
  });

  it('rounds the package size in package mode', () => {
    expect(
      resolveGrams('package', { servings: 1, customGrams: 100, ...sizes })
    ).toBe(300);
  });

  it('uses the custom amount in grams mode', () => {
    expect(
      resolveGrams('grams', { servings: 1, customGrams: 175, ...sizes })
    ).toBe(175);
  });

  it('falls back to the custom amount when the mode has no sizing', () => {
    expect(
      resolveGrams('serving', {
        servings: 3,
        customGrams: 175,
        servingSizeG: null,
        packageSizeG: null,
      })
    ).toBe(175);
  });

  it('clamps whatever the mode resolves to', () => {
    expect(
      resolveGrams('grams', {
        servings: 1,
        customGrams: 0,
        servingSizeG: null,
        packageSizeG: null,
      })
    ).toBe(1);
  });
});
