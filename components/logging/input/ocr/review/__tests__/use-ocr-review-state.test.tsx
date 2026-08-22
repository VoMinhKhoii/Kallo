import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  NutritionValues,
  ParsedNutritionLabel,
} from '@/lib/domain/nutrition/ocr/schema';
import { parseLocaleDecimal, useOcrReviewState } from '../use-ocr-review-state';

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
  productName: 'Test food',
  labelEvidence: 'Nutrition Facts — Calories, Protein',
  servingSizeDescription: null,
  servingsPerContainer: 2,
  confidence: 'medium' as const,
};

describe('useOcrReviewState', () => {
  it('accepts comma decimals without turning a cleared field into zero', () => {
    expect(parseLocaleDecimal('3,5')).toBe(3.5);
    expect(parseLocaleDecimal('')).toBeNull();
    expect(parseLocaleDecimal('3,5,2')).toBeNull();
  });

  it('keeps missing macros null and blocks confirmation', () => {
    const data: ParsedNutritionLabel = {
      ...metadata,
      servingSize: { value: 50, unit: 'g' },
      basis: 'per_serving',
      perServing: nutrition({ calories: 100, proteinGrams: 5 }),
    };
    const { result } = renderHook(() =>
      useOcrReviewState(data, 'Scanned food')
    );

    expect(result.current.nutrition.carbsGrams).toBeNull();
    expect(result.current.nutrition.fatGrams).toBeNull();
    expect(result.current.canConfirm).toBe(false);
  });

  it('scales from manually corrected canonical values after quantity changes', () => {
    const data: ParsedNutritionLabel = {
      ...metadata,
      servingSize: null,
      basis: 'per_100g',
      per100g: nutrition({
        calories: 200,
        proteinGrams: 10,
        carbsGrams: 20,
        fatGrams: 5,
        magnesiumMg: 30,
      }),
    };
    const { result } = renderHook(() =>
      useOcrReviewState(data, 'Scanned food')
    );

    act(() => result.current.setNutrientText('proteinGrams', '20'));
    act(() => result.current.commitAmount('200'));

    expect(result.current.nutrition.proteinGrams).toBe(40);
    expect(result.current.nutrition.magnesiumMg).toBe(60);
  });

  it('flags unparseable optional nutrients and blocks confirmation', () => {
    const data: ParsedNutritionLabel = {
      ...metadata,
      servingSize: null,
      basis: 'per_100g',
      per100g: nutrition({
        calories: 200,
        proteinGrams: 10,
        carbsGrams: 20,
        fatGrams: 5,
      }),
    };
    const { result } = renderHook(() =>
      useOcrReviewState(data, 'Scanned food')
    );

    expect(result.current.canConfirm).toBe(true);

    act(() => result.current.setNutrientText('magnesiumMg', '12g'));

    expect(result.current.getNutrientValue('magnesiumMg')).toBeNull();
    expect(result.current.nutrientHasError('magnesiumMg')).toBe(true);
    expect(result.current.canConfirm).toBe(false);
  });

  it('models a serving without gram or ml size as one serving', () => {
    const data: ParsedNutritionLabel = {
      ...metadata,
      servingSize: null,
      basis: 'per_serving',
      perServing: nutrition({ calories: 100, proteinGrams: 5 }),
    };
    const { result } = renderHook(() =>
      useOcrReviewState(data, 'Scanned food')
    );

    expect(result.current.amountText).toBe('1');
    expect(result.current.unit).toBe('serving');
  });

  it('uses container net content and serving count metadata', () => {
    const data: ParsedNutritionLabel = {
      ...metadata,
      servingSize: null,
      basis: 'per_container',
      netContent: { value: 330, unit: 'ml' },
      servingsPerContainer: 1.5,
      perContainer: nutrition({ calories: 150, carbsGrams: 35 }),
    };
    const { result } = renderHook(() =>
      useOcrReviewState(data, 'Scanned food')
    );

    expect(result.current.amountText).toBe('330');
    expect(result.current.unit).toBe('ml');
    expect(result.current.servingsPerContainer).toBe(1.5);
  });

  it('starts a manual fallback with blank nutrients and low-authority defaults', () => {
    const { result } = renderHook(() =>
      useOcrReviewState(null, 'Manual packaged food')
    );

    expect(result.current.productName).toBe('Manual packaged food');
    expect(result.current.getNutrientText('calories')).toBe('');
    expect(result.current.canConfirm).toBe(false);
  });
});
