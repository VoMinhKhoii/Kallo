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
import {
  blankScanFood,
  editScanFood,
  emptyNutrition,
  scanFoodFromBarcode,
} from '@/lib/domain/scan/food';

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
  it('steps servings and packs along the fractional ladder and custom by 10', () => {
    let amount = stepScanAmount(initialScanAmount(food), food, 1);
    expect(amount.servings).toBe(1.5);
    expect(resolveScanAmount(amount, food)).toBe(150);
    amount = stepScanAmount(amount, food, 1);
    expect(amount.servings).toBe(2);
    expect(resolveScanAmount(amount, food)).toBe(200);

    amount = stepScanAmount(withPortion(amount, food, 'pack'), food, 1);
    expect(amount.packs).toBe(1.5);
    expect(resolveScanAmount(amount, food)).toBe(1500);
    amount = withPortion(amount, food, 'custom');
    expect(resolveScanAmount(amount, food)).toBe(1500);
    expect(resolveScanAmount(stepScanAmount(amount, food, -1), food)).toBe(
      1500 - CUSTOM_STEP
    );
  });

  it('steps servings and packs below 1 down to 0.25 through thirds and halves', () => {
    let amount = initialScanAmount(food);
    const servingSteps: number[] = [];
    while (canStepScanAmount(amount, food, -1)) {
      amount = stepScanAmount(amount, food, -1);
      servingSteps.push(amount.servings);
    }
    expect(servingSteps).toEqual([0.75, 2 / 3, 0.5, 1 / 3, 0.25]);
    expect(resolveScanAmount(amount, food)).toBe(25);
    expect(canStepScanAmount(amount, food, -1)).toBe(false);

    let pack = withPortion(initialScanAmount(food), food, 'pack');
    const packSteps: number[] = [];
    while (canStepScanAmount(pack, food, -1)) {
      pack = stepScanAmount(pack, food, -1);
      packSteps.push(pack.packs);
    }
    expect(packSteps).toEqual([0.75, 2 / 3, 0.5, 1 / 3, 0.25]);
    expect(resolveScanAmount(pack, food)).toBe(250);
    expect(canStepScanAmount(pack, food, -1)).toBe(false);

    const custom = withCustom(amount, 5);
    expect(resolveScanAmount(stepScanAmount(custom, food, -1), food)).toBe(1);
  });

  it('editing a barcode product to 1 serving keeps the serving portion and scales below 1', () => {
    const edited = editScanFood(food, {
      name: 'Mini Wontons',
      unit: 'serving',
      basisAmount: 1,
      values: {
        ...emptyNutrition(),
        calories: 210,
        proteinGrams: 13,
        carbsGrams: 31,
        fatGrams: 5,
      },
    });
    expect(portionsFor(edited)).toEqual(['serving']);
    let amount = initialScanAmount(edited);
    amount = stepScanAmount(amount, edited, -1); // 0.75
    amount = stepScanAmount(amount, edited, -1); // 2/3
    amount = stepScanAmount(amount, edited, -1); // 0.5
    expect(amount.servings).toBe(0.5);
    expect(resolveScanAmount(amount, edited)).toBe(0.5);
  });

  it('rounds a fractional resolved amount when carrying into custom g/ml', () => {
    let amount = initialScanAmount(food);
    for (let i = 0; i < 4; i++) amount = stepScanAmount(amount, food, -1); // 1/3 of 100 ml
    const custom = withPortion(amount, food, 'custom');
    expect(custom.custom).toBe(33);
    expect(resolveScanAmount(custom, food)).toBe(33);
  });

  it('stops a count where the entry would pass the log limit', () => {
    const rice = scanFoodFromBarcode(
      product({ servingSizeG: null, packageSizeG: 2000, amountUnit: 'g' })
    );
    let amount = initialScanAmount(rice);
    expect(amount.portion).toBe('pack');
    for (let i = 0; i < 120; i++) amount = stepScanAmount(amount, rice, 1);
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
