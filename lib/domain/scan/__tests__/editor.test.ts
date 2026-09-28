import { describe, expect, it } from 'vitest';
import type { ParsedBarcodeProduct } from '@/lib/domain/barcode/types';
import {
  basesFor,
  draftToFood,
  fieldError,
  fieldTexts,
  isDraftValid,
  parseDecimal,
} from '@/lib/domain/scan/editor';
import {
  blankScanFood,
  logsByBarcode,
  scanFoodFromBarcode,
} from '@/lib/domain/scan/food';

const product: ParsedBarcodeProduct = {
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
};

const filled = () => ({
  ...fieldTexts(blankScanFood().values),
  calories: '250',
  proteinGrams: '10',
  carbsGrams: '30',
  fatGrams: '8',
});

describe('the scan editor', () => {
  it('seeds known values as typed and unknown ones blank', () => {
    const texts = fieldTexts(scanFoodFromBarcode(product).values);
    expect(texts.calories).toBe('16');
    expect(texts.proteinGrams).toBe('0');
    expect(texts.fiberGrams).toBe('');
  });

  it('waits for a name and the four the log requires', () => {
    expect(isDraftValid('', filled())).toBe(false);
    expect(isDraftValid('Chè bắp', filled())).toBe(true);
    expect(isDraftValid('Chè bắp', { ...filled(), fatGrams: '' })).toBe(false);
    expect(isDraftValid('Chè bắp', { ...filled(), fatGrams: '0' })).toBe(true);
    expect(isDraftValid('x'.repeat(201), filled())).toBe(false);
  });

  it('flags malformed and out-of-range values, never a blank one', () => {
    for (const bad of ['1e3', '-5', 'abc', 'Infinity']) {
      expect(fieldError('sodiumMg', bad)).toBe(true);
    }
    expect(fieldError('sodiumMg', '12,5')).toBe(false);
    expect(fieldError('calories', '20001')).toBe(true);
    expect(fieldError('sodiumMg', '')).toBe(false);
    expect(parseDecimal('3,5')).toBe(3.5);
  });

  it('hands back blank as unknown, 0 as zero, and relabels on a new basis', () => {
    const source = scanFoodFromBarcode(product);
    const food = draftToFood(source, {
      name: ' Nước dừa ',
      basis: { amount: 1, unit: 'serving' },
      fields: { ...fieldTexts(source.values), sodiumMg: '0' },
    });
    expect(food.name).toBe('Nước dừa');
    expect(food.unit).toBe('serving');
    expect(food.values.calories).toBe(16);
    expect(food.values.sodiumMg).toBe(0);
    expect(food.values.fiberGrams).toBeNull();
    expect(food.servingSize).toBeNull();
    expect(logsByBarcode(food)).toBe(false);
  });

  it("offers 100 g, 100 ml and a serving, plus the source's own once", () => {
    expect(basesFor({ amount: 100, unit: 'g' })).toHaveLength(3);
    expect(basesFor({ amount: 330, unit: 'ml' }).at(-1)).toEqual({
      amount: 330,
      unit: 'ml',
    });
  });
});
