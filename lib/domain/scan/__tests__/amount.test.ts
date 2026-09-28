import { describe, expect, it } from 'vitest';
import type { ParsedBarcodeProduct } from '@/lib/domain/barcode/types';
import {
  CUSTOM_STEP,
  canStepScanAmount,
  formatSize,
  initialScanAmount,
  MAX_SCAN_AMOUNT,
  portionsFor,
  resolveScanAmount,
  stepScanAmount,
  withCustom,
  withPortion,
} from '@/lib/domain/scan/amount';
import { blankScanFood, scanFoodFromBarcode } from '@/lib/domain/scan/food';

const product = (
  overrides: Partial<ParsedBarcodeProduct>
): ParsedBarcodeProduct => ({
  barcode: '8938507849131',
  name: 'Coconut Water',
  brand: 'Coco Xim',
  caloriesKcal: 16,
  proteinG: 0,
  carbohydrateG: 4,
  fatG: 0,
  fiberG: null,
  sodiumMg: null,
  servingSizeG: 100,
  packageSizeG: 1000,
  amountUnit: 'ml',
  imageUrl: null,
  micronutrients: null,
  ...overrides,
});

const food = scanFoodFromBarcode(product({}));

describe('portions', () => {
  it('offers serving, pack and custom, starting on one serving', () => {
    expect(portionsFor(food)).toEqual(['serving', 'pack', 'custom']);
    const amount = initialScanAmount(food);
    expect(amount.portion).toBe('serving');
    expect(resolveScanAmount(amount, food)).toBe(100);
  });

  it('offers only custom when nothing is sized', () => {
    expect(portionsFor(blankScanFood())).toEqual(['custom']);
    expect(
      resolveScanAmount(initialScanAmount(blankScanFood()), blankScanFood())
    ).toBe(100);
  });
});

describe('stepping', () => {
  it('counts servings and packs by one, custom by 10', () => {
    let amount = stepScanAmount(initialScanAmount(food), food, 1);
    expect(resolveScanAmount(amount, food)).toBe(200);
    amount = stepScanAmount(withPortion(amount, food, 'pack'), food, 1);
    expect(resolveScanAmount(amount, food)).toBe(2000);
    amount = withPortion(amount, food, 'custom');
    expect(resolveScanAmount(amount, food)).toBe(2000);
    expect(resolveScanAmount(stepScanAmount(amount, food, -1), food)).toBe(
      2000 - CUSTOM_STEP
    );
  });

  it('never goes below one', () => {
    const amount = initialScanAmount(food);
    expect(canStepScanAmount(amount, food, -1)).toBe(false);
    const custom = withCustom(amount, 5);
    expect(resolveScanAmount(stepScanAmount(custom, food, -1), food)).toBe(1);
  });

  it('stops a count where the entry would pass the log limit', () => {
    const rice = scanFoodFromBarcode(
      product({ servingSizeG: null, packageSizeG: 2000, amountUnit: 'g' })
    );
    let amount = initialScanAmount(rice);
    expect(amount.portion).toBe('pack');
    for (let i = 0; i < 80; i++) amount = stepScanAmount(amount, rice, 1);
    expect(amount.packs).toBe(MAX_SCAN_AMOUNT / 2000);
    expect(canStepScanAmount(amount, rice, 1)).toBe(false);
  });

  it('keeps a typed amount inside the limits', () => {
    const amount = initialScanAmount(food);
    expect(withCustom(amount, 0).custom).toBe(1);
    expect(withCustom(amount, 999_999).custom).toBe(MAX_SCAN_AMOUNT);
    expect(withCustom(amount, 250).portion).toBe('custom');
  });
});

describe('formatSize', () => {
  it('reads the way a pack prints it', () => {
    expect(formatSize(100, 'ml')).toBe('100 ml');
    expect(formatSize(1000, 'ml')).toBe('1 L');
    expect(formatSize(1500, 'g')).toBe('1.5 kg');
    expect(formatSize(330, 'ml')).toBe('330 ml');
    expect(formatSize(12.5, 'g')).toBe('12.5 g');
  });
});
