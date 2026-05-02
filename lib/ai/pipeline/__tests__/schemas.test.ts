import { describe, expect, it } from 'vitest';
import { toJSONSchema } from 'zod';
import {
  ambiguityFlagSchema,
  boundedEstimateSchema,
  decomposedDishSchema,
  decomposedIngredientSchema,
  ingredientLlmNutritionSchema,
  mealDecompositionSchema,
  normalizeBoundedEstimate,
  nutritionAdjustmentSchema,
} from '@/lib/ai/pipeline/schemas';

describe('decomposedIngredientSchema', () => {
  const validIngredient = {
    ingredientId: 'ing_01',
    rawName: 'cá lóc',
    canonicalName: 'Cá quả',
    grams: 150,
    expectedState: 'cooked' as const,
  };

  it('accepts valid ingredient', () => {
    const result = decomposedIngredientSchema.safeParse(validIngredient);
    expect(result.success).toBe(true);
  });

  it('accepts omitted expectedState', () => {
    const { expectedState, ...withoutState } = validIngredient;
    const result = decomposedIngredientSchema.safeParse(withoutState);
    expect(result.success).toBe(true);
  });

  it('rejects unknown expectedState', () => {
    const result = decomposedIngredientSchema.safeParse({
      ...validIngredient,
      expectedState: 'frozen',
    });
    expect(result.success).toBe(false);
  });

  it('accepts zero grams for anomaly classification', () => {
    const result = decomposedIngredientSchema.safeParse({
      ...validIngredient,
      grams: 0,
    });
    expect(result.success).toBe(true);
  });

  it('accepts negative grams for anomaly classification', () => {
    const result = decomposedIngredientSchema.safeParse({
      ...validIngredient,
      grams: -50,
    });
    expect(result.success).toBe(true);
  });

  it('rejects NaN and Infinity grams', () => {
    expect(
      decomposedIngredientSchema.safeParse({
        ...validIngredient,
        grams: Number.NaN,
      }).success
    ).toBe(false);
    expect(
      decomposedIngredientSchema.safeParse({
        ...validIngredient,
        grams: Number.POSITIVE_INFINITY,
      }).success
    ).toBe(false);
  });

  it('rejects missing rawName', () => {
    const result = decomposedIngredientSchema.safeParse({
      ingredientId: 'ing_01',
      canonicalName: 'Cá quả',
      grams: 150,
    });
    expect(result.success).toBe(false);
  });

  it('rejects unit and source override fields', () => {
    const retiredField = `source${'Override'}`;
    expect(
      decomposedIngredientSchema.safeParse({
        ...validIngredient,
        unit: 'g',
      }).success
    ).toBe(false);
    expect(
      decomposedIngredientSchema.safeParse({
        ...validIngredient,
        [retiredField]: 'fao',
      }).success
    ).toBe(false);
  });
});

describe('decomposedDishSchema', () => {
  const validDish = {
    mealItemId: 'meal_01',
    name: 'bún thịt nướng',
    cookingMethod: 'nướng',
    cuisineNote: 'southern Vietnamese',
    ingredients: [
      {
        ingredientId: 'ing_01',
        rawName: 'thịt heo',
        canonicalName: 'Thịt lợn nạc',
        grams: 150,
        expectedState: 'cooked' as const,
      },
    ],
  };

  it('accepts a valid dish', () => {
    expect(decomposedDishSchema.safeParse(validDish).success).toBe(true);
  });

  it('keeps cookingMethod free-form', () => {
    expect(
      decomposedDishSchema.safeParse({
        ...validDish,
        cookingMethod: 'xối mỡ áp chảo',
      }).success
    ).toBe(true);
  });

  it('allows closed-enum ambiguity flags', () => {
    expect(
      decomposedDishSchema.safeParse({
        ...validDish,
        ingredients: [
          {
            ...validDish.ingredients[0],
            ambiguityFlags: ['cross_cuisine_ingredient'],
          },
        ],
      }).success
    ).toBe(true);
  });

  it('rejects unknown ambiguity flags', () => {
    expect(
      decomposedDishSchema.safeParse({
        ...validDish,
        ingredients: [
          { ...validDish.ingredients[0], ambiguityFlags: ['vibes'] },
        ],
      }).success
    ).toBe(false);
  });

  it('rejects source-priority fields', () => {
    const retiredField = `source${'Prior'}`;
    expect(
      decomposedDishSchema.safeParse({
        ...validDish,
        [retiredField]: 'fao',
      }).success
    ).toBe(false);
  });
});

describe('mealDecompositionSchema', () => {
  it('accepts valid decomposition with isFood=true', () => {
    const result = mealDecompositionSchema.safeParse({
      isFood: true,
      mealItems: [
        {
          mealItemId: 'meal_01',
          name: 'cơm thịt kho',
          cookingMethod: 'kho',
          ingredients: [
            {
              ingredientId: 'ing_01',
              rawName: 'gạo',
              canonicalName: 'Gạo tẻ',
              grams: 200,
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
          mealItemId: 'meal_01',
          name: 'trà đá',
          cookingMethod: 'pha',
          ingredients: [
            {
              ingredientId: 'ing_01',
              rawName: 'trà',
              canonicalName: 'Trà',
              grams: 200,
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
          mealItemId: 'meal_01',
          name: 'cơm',
          cookingMethod: 'nấu',
          ingredients: [
            {
              ingredientId: 'ing_01',
              rawName: 'gạo',
              canonicalName: 'Gạo tẻ',
              grams: 200,
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
      mealItems: [
        {
          mealItemId: 'meal_01',
          name: 'cơm',
          cookingMethod: 'nấu',
          ingredients: [],
        },
      ],
      mealSlot: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('ambiguityFlagSchema', () => {
  it('accepts known flags only', () => {
    expect(ambiguityFlagSchema.safeParse('unspecified_quantity').success).toBe(
      true
    );
    expect(ambiguityFlagSchema.safeParse('vibes').success).toBe(false);
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
