import { describe, expect, it } from 'vitest';
import type { ParsedBarcodeProduct } from '@/lib/domain/barcode/types';
import type { ParsedNutritionLabel } from '@/lib/domain/nutrition/ocr/schema';
import {
  blankScanFood,
  editScanFood,
  emptyNutrition,
  hasRequired,
  logsByBarcode,
  nutritionFor,
  scanFoodFromBarcode,
  scanFoodFromLabel,
  valueFor,
} from '@/lib/domain/scan/food';

const coconutWater: ParsedBarcodeProduct = {
  barcode: '8938507849131',
  name: 'Coconut Water',
  brand: 'Coco Xim',
  caloriesKcal: 16,
  proteinG: 0,
  carbohydrateG: 4,
  fatG: 0,
  fiberG: null,
  sodiumMg: 39,
  servingSizeG: 100,
  packageSizeG: 1000,
  amountUnit: 'ml',
  imageUrl: null,
  micronutrients: { calciumMg: 10, potassiumMg: 170 },
};

const biscuitLabel = {
  basis: 'per_100g',
  confidence: 'high',
  labelEvidence: 'Thông tin dinh dưỡng',
  productName: 'Bánh quy Cosy',
  servingSize: { value: 30, unit: 'g' },
  servingSizeDescription: '1 gói',
  servingsPerContainer: 5,
  per100g: {
    ...emptyNutrition(),
    calories: 480,
    proteinGrams: 6,
    carbsGrams: 62,
    fatGrams: 22,
    sodiumMg: 320,
  },
} as unknown as ParsedNutritionLabel;

describe('scanFoodFromBarcode', () => {
  it('is per 100 of its unit, sized by serving and pack', () => {
    const food = scanFoodFromBarcode(coconutWater);
    expect(food.unit).toBe('ml');
    expect(food.basisAmount).toBe(100);
    expect(food.servingSize).toBe(100);
    expect(food.packageSize).toBe(1000);
    expect(food.values.calories).toBe(16);
    expect(food.values.carbsGrams).toBe(4);
    expect(food.values.calciumMg).toBe(10);
    expect(logsByBarcode(food)).toBe(true);
  });

  it('keeps unknown unknown and zero zero', () => {
    const food = scanFoodFromBarcode(coconutWater);
    expect(food.values.fiberGrams).toBeNull();
    expect(food.values.proteinGrams).toBe(0);
    const scaled = nutritionFor(food, 250);
    expect(scaled.fiberGrams).toBeNull();
    expect(scaled.proteinGrams).toBe(0);
    expect(scaled.calories).toBe(40);
    expect(scaled.carbsGrams).toBe(10);
  });

  it('an edited product logs its own numbers, not the barcode', () => {
    const food = scanFoodFromBarcode(coconutWater);
    const edited = editScanFood(food, {
      name: food.name,
      unit: food.unit,
      basisAmount: food.basisAmount,
      values: { ...food.values, calories: 20 },
    });
    expect(logsByBarcode(edited)).toBe(false);
    expect(edited.servingSize).toBe(100);
  });

  it('a new unit drops sizes that no longer mean anything', () => {
    const food = scanFoodFromBarcode(coconutWater);
    const perServing = editScanFood(food, {
      name: food.name,
      unit: 'serving',
      basisAmount: 1,
      values: food.values,
    });
    expect(perServing.servingSize).toBeNull();
    expect(perServing.packageSize).toBeNull();
  });
});

describe('scanFoodFromLabel', () => {
  it('reads its printed column, name, serving and pack', () => {
    const food = scanFoodFromLabel(biscuitLabel, 'Scanned food');
    expect(food.source).toBe('label');
    expect(food.name).toBe('Bánh quy Cosy');
    expect(food.unit).toBe('g');
    expect(food.basisAmount).toBe(100);
    expect(food.servingSize).toBe(30);
    expect(food.packageSize).toBe(150);
    expect(valueFor(food, 'calories', 30)).toBeCloseTo(144);
    expect(logsByBarcode(food)).toBe(false);
  });

  it('falls back to a name when the label prints none', () => {
    const food = scanFoodFromLabel(
      { ...biscuitLabel, productName: '  ' } as ParsedNutritionLabel,
      'Scanned food'
    );
    expect(food.name).toBe('Scanned food');
  });
});

describe('blankScanFood', () => {
  it('starts empty, per 100 g, and cannot save yet', () => {
    const food = blankScanFood();
    expect(food.name).toBe('');
    expect(food.unit).toBe('g');
    expect(Object.values(food.values).every((v) => v === null)).toBe(true);
    expect(hasRequired(food)).toBe(false);
  });
});
