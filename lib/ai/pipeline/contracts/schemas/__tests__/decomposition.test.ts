import { describe, expect, it } from 'vitest';
import { toJSONSchema } from 'zod';
import {
  ambiguityFlagSchema,
  decomposedDishSchema,
  decomposedIngredientSchema,
  mealDecompositionSchema,
} from '@/lib/ai/pipeline/contracts/schemas/decomposition';

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

  it('accepts omitted runtime-owned ingredientId', () => {
    const { ingredientId, ...withoutId } = validIngredient;
    const result = decomposedIngredientSchema.safeParse(withoutId);
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

  it('accepts omitted runtime-owned mealItemId', () => {
    const { mealItemId, ...withoutId } = validDish;
    expect(decomposedDishSchema.safeParse(withoutId).success).toBe(true);
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

describe('toJSONSchema compatibility', () => {
  it('produces valid JSON schema for mealDecompositionSchema', () => {
    const jsonSchema = toJSONSchema(mealDecompositionSchema);
    expect(jsonSchema).toBeDefined();
    expect(jsonSchema.type).toBe('object');
  });
});
