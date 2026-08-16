import { describe, expect, it } from 'vitest';
import {
  type NutritionValues,
  nutritionLabelScanSchema,
  nutritionValuesSchema,
} from '../ocr-schema';

function nutrition(overrides: Partial<NutritionValues> = {}): NutritionValues {
  return {
    calories: null,
    proteinGrams: null,
    carbsGrams: null,
    fatGrams: null,
    fiberGrams: null,
    sodiumMg: null,
    calciumMg: null,
    ironMg: null,
    magnesiumMg: null,
    phosphorusMg: null,
    potassiumMg: null,
    zincMg: null,
    copperMcg: null,
    manganeseMg: null,
    betaCaroteneMcg: null,
    vitaminAMcg: null,
    vitaminCMg: null,
    vitaminDMcg: null,
    vitaminEMg: null,
    vitaminKMcg: null,
    vitaminB1Mg: null,
    vitaminB2Mg: null,
    vitaminPpMg: null,
    vitaminB5Mg: null,
    vitaminB6Mg: null,
    vitaminB9Mcg: null,
    vitaminB12Mcg: null,
    vitaminHMcg: null,
    ...overrides,
  };
}

const metadata = {
  productName: 'Hảo Hảo Tôm Chua Cay',
  labelEvidence: 'Bảng giá trị dinh dưỡng — Năng lượng, Chất đạm',
  servingSize: { value: 75, unit: 'g' as const },
  servingSizeDescription: '1 gói (75g)',
  servingsPerContainer: 1,
  confidence: 'high' as const,
};

describe('nutritionLabelScanSchema', () => {
  it('preserves null separately from a printed zero', () => {
    const parsed = nutritionValuesSchema.parse(
      nutrition({ calories: 0, proteinGrams: 0 })
    );
    expect(parsed.calories).toBe(0);
    expect(parsed.proteinGrams).toBe(0);
    expect(parsed.carbsGrams).toBeNull();
  });

  it('keeps per-100g and per-100ml as distinct strict variants', () => {
    const per100g = nutritionLabelScanSchema.parse({
      ...metadata,
      basis: 'per_100g',
      per100g: nutrition({ calories: 450, proteinGrams: 12 }),
    });
    const per100ml = nutritionLabelScanSchema.parse({
      ...metadata,
      servingSize: { value: 330, unit: 'ml' },
      basis: 'per_100ml',
      per100ml: nutrition({ calories: 42, carbsGrams: 10.5 }),
    });

    expect(per100g.basis).toBe('per_100g');
    expect(per100ml.basis).toBe('per_100ml');
    expect(
      nutritionLabelScanSchema.safeParse({
        ...metadata,
        basis: 'per_100g',
        per100g: nutrition({ calories: 100, carbsGrams: 20 }),
        perServing: nutrition({ calories: 50, carbsGrams: 10 }),
      }).success
    ).toBe(false);
  });

  it('requires net content and uses a positive serving count for containers', () => {
    const parsed = nutritionLabelScanSchema.parse({
      ...metadata,
      basis: 'per_container',
      netContent: { value: 330, unit: 'ml' },
      servingsPerContainer: 1.5,
      perContainer: nutrition({ calories: 150, carbsGrams: 35 }),
    });

    expect(parsed.basis).toBe('per_container');
    if (parsed.basis !== 'per_container') throw new Error('wrong basis');
    expect(parsed.netContent).toEqual({ value: 330, unit: 'ml' });
    expect(parsed.servingsPerContainer).toBe(1.5);
  });

  it('rejects missing evidence or fewer than two absolute core values', () => {
    const base = {
      ...metadata,
      basis: 'per_serving',
      perServing: nutrition({ calories: 220 }),
    };
    expect(nutritionLabelScanSchema.safeParse(base).success).toBe(false);
    expect(
      nutritionLabelScanSchema.safeParse({
        ...base,
        labelEvidence: '',
        perServing: nutrition({ calories: 220, proteinGrams: 20 }),
      }).success
    ).toBe(false);
  });

  it.each([
    ['negative', { proteinGrams: -1 }],
    ['NaN', { calories: Number.NaN }],
    ['Infinity', { sodiumMg: Number.POSITIVE_INFINITY }],
    ['nutrient maximum', { vitaminDMcg: 10_001 }],
  ])('rejects %s nutrient values', (_name, override) => {
    const values = nutrition({ calories: 200, carbsGrams: 20, ...override });
    expect(nutritionValuesSchema.safeParse(values).success).toBe(false);
  });

  it('rejects impossible per-100-unit macro density', () => {
    expect(
      nutritionLabelScanSchema.safeParse({
        ...metadata,
        basis: 'per_100g',
        per100g: nutrition({ calories: 500, fatGrams: 101 }),
      }).success
    ).toBe(false);
  });
});
