import { describe, expect, it } from 'vitest';
import { toJSONSchema } from 'zod';
import {
  boundedEstimateSchema,
  decomposedIngredientSchema,
  ingredientLlmNutritionSchema,
  mealDecompositionSchema,
  normalizeBoundedEstimate,
  nutritionAdjustmentSchema,
} from '../pipeline/schemas';

describe('decomposedIngredientSchema', () => {
  it('accepts valid ingredient', () => {
    const result = decomposedIngredientSchema.safeParse({
      name: 'thịt bò',
      estimatedGrams: 150,
      cookingMethod: 'luộc',
      userFacingUnit: '1 miếng',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null cookingMethod and userFacingUnit', () => {
    const result = decomposedIngredientSchema.safeParse({
      name: 'gạo',
      estimatedGrams: 200,
      cookingMethod: null,
      userFacingUnit: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects zero grams', () => {
    const result = decomposedIngredientSchema.safeParse({
      name: 'gạo',
      estimatedGrams: 0,
      cookingMethod: null,
      userFacingUnit: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative grams', () => {
    const result = decomposedIngredientSchema.safeParse({
      name: 'gạo',
      estimatedGrams: -50,
      cookingMethod: null,
      userFacingUnit: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = decomposedIngredientSchema.safeParse({
      estimatedGrams: 100,
      cookingMethod: null,
      userFacingUnit: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('mealDecompositionSchema', () => {
  it('accepts valid decomposition with isFood=true', () => {
    const result = mealDecompositionSchema.safeParse({
      isFood: true,
      mealItems: [
        {
          name: 'cơm thịt kho',
          ingredients: [
            {
              name: 'gạo',
              estimatedGrams: 200,
              cookingMethod: null,
              userFacingUnit: '1 chén',
            },
          ],
        },
      ],
      mealSlot: 'lunch',
    });
    expect(result.success).toBe(true);
  });

  it('accepts isFood=false with empty mealItems', () => {
    const result = mealDecompositionSchema.safeParse({
      isFood: false,
      mealItems: [],
      mealSlot: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts null meal slot', () => {
    const result = mealDecompositionSchema.safeParse({
      isFood: true,
      mealItems: [
        {
          name: 'trà đá',
          ingredients: [
            {
              name: 'trà',
              estimatedGrams: 200,
              cookingMethod: null,
              userFacingUnit: '1 ly',
            },
          ],
        },
      ],
      mealSlot: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid meal slot', () => {
    const result = mealDecompositionSchema.safeParse({
      isFood: true,
      mealItems: [
        {
          name: 'cơm',
          ingredients: [
            {
              name: 'gạo',
              estimatedGrams: 200,
              cookingMethod: null,
              userFacingUnit: null,
            },
          ],
        },
      ],
      mealSlot: 'midnight_snack',
    });
    expect(result.success).toBe(false);
  });

  it('rejects meal item with empty ingredients', () => {
    const result = mealDecompositionSchema.safeParse({
      isFood: true,
      mealItems: [{ name: 'cơm', ingredients: [] }],
      mealSlot: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('boundedEstimateSchema', () => {
  it('accepts valid bounded estimate', () => {
    const result = boundedEstimateSchema.safeParse({
      low: 100,
      mid: 150,
      high: 200,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ low: 100, mid: 150, high: 200 });
    }
  });

  it('accepts equal low/mid/high (exact match)', () => {
    const result = boundedEstimateSchema.safeParse({
      low: 100,
      mid: 100,
      high: 100,
    });
    expect(result.success).toBe(true);
  });

  it('accepts out-of-order bounds (normalization happens post-parse)', () => {
    const result = boundedEstimateSchema.safeParse({
      low: 200,
      mid: 150,
      high: 300,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing mid', () => {
    const result = boundedEstimateSchema.safeParse({ low: 100, high: 200 });
    expect(result.success).toBe(false);
  });
});

describe('normalizeBoundedEstimate', () => {
  it('returns same values when already ordered', () => {
    expect(normalizeBoundedEstimate({ low: 1, mid: 2, high: 3 })).toEqual({
      low: 1,
      mid: 2,
      high: 3,
    });
  });

  it('sorts out-of-order values', () => {
    expect(normalizeBoundedEstimate({ low: 3, mid: 1, high: 2 })).toEqual({
      low: 1,
      mid: 2,
      high: 3,
    });
  });
});

describe('nutritionAdjustmentSchema', () => {
  const validIngredient = {
    ingredientName: 'gạo',
    caloriesKcal: { low: 300, mid: 350, high: 400 },
    proteinG: { low: 5, mid: 7, high: 9 },
    carbohydrateG: { low: 70, mid: 78, high: 85 },
    fatG: { low: 0.5, mid: 1, high: 1.5 },
  };

  it('accepts valid nutrition adjustment', () => {
    const result = nutritionAdjustmentSchema.safeParse({
      mealItems: [
        {
          mealItemName: 'cơm',
          ingredients: [validIngredient],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty mealItems', () => {
    const result = nutritionAdjustmentSchema.safeParse({ mealItems: [] });
    expect(result.success).toBe(false);
  });
});

describe('toJSONSchema compatibility', () => {
  it('produces valid JSON schema for mealDecompositionSchema', () => {
    const jsonSchema = toJSONSchema(mealDecompositionSchema);
    expect(jsonSchema).toBeDefined();
    expect(jsonSchema.type).toBe('object');
  });

  it('produces valid JSON schema for ingredientLlmNutritionSchema', () => {
    const jsonSchema = toJSONSchema(ingredientLlmNutritionSchema);
    expect(jsonSchema).toBeDefined();
    expect(jsonSchema.type).toBe('object');
  });
});
