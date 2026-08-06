import { describe, expect, it } from 'vitest';
import { nutritionLabelScanSchema } from '../ocr-schema';

describe('nutritionLabelScanSchema', () => {
  it('parses valid per-serving OCR extraction result', () => {
    const raw = {
      productName: 'Hảo Hảo Tôm Chua Cay',
      servingSizeGrams: 75,
      servingSizeDescription: '1 gói (75g)',
      servingsPerContainer: 1,
      basis: 'per_serving',
      perServing: {
        calories: 350,
        proteinGrams: 6.8,
        carbsGrams: 51.2,
        fatGrams: 13.5,
        fiberGrams: 2.1,
        sodiumMg: 1100,
      },
      confidence: 'high',
    };

    const parsed = nutritionLabelScanSchema.parse(raw);
    expect(parsed.productName).toBe('Hảo Hảo Tôm Chua Cay');
    expect(parsed.servingSizeGrams).toBe(75);
    expect(parsed.basis).toBe('per_serving');
    expect(parsed.perServing?.calories).toBe(350);
  });

  it('parses all DB-backed micronutrients when present on label', () => {
    const raw = {
      productName: 'Protein Bar',
      servingSizeGrams: 60,
      basis: 'per_serving',
      perServing: {
        calories: 220,
        proteinGrams: 20,
        carbsGrams: 24,
        fatGrams: 7,
        fiberGrams: 10,
        sodiumMg: 200,
        calciumMg: 150,
        ironMg: 3,
        potassiumMg: 300,
        vitaminAMcg: 100,
        vitaminCMg: 15,
        vitaminDMcg: 2.5,
      },
      confidence: 'high',
    };

    const parsed = nutritionLabelScanSchema.parse(raw);
    expect(parsed.perServing?.fiberGrams).toBe(10);
    expect(parsed.perServing?.sodiumMg).toBe(200);
    expect(parsed.perServing?.potassiumMg).toBe(300);
    expect(parsed.perServing?.vitaminCMg).toBe(15);
  });

  it('parses per-100g OCR result with missing non-essential fields', () => {
    const raw = {
      productName: null,
      servingSizeGrams: null,
      basis: 'per_100g',
      per100g: {
        calories: 450,
        proteinGrams: 12,
        carbsGrams: 60,
        fatGrams: 18,
      },
      confidence: 'medium',
    };

    const parsed = nutritionLabelScanSchema.parse(raw);
    expect(parsed.basis).toBe('per_100g');
    expect(parsed.per100g?.calories).toBe(450);
    expect(parsed.per100g?.proteinGrams).toBe(12);
  });

  it('rejects invalid confidence level or basis', () => {
    const invalid = {
      servingSizeGrams: 50,
      basis: 'unknown_basis',
      confidence: 'super_high',
    };

    expect(() => nutritionLabelScanSchema.parse(invalid)).toThrow();
  });
});
