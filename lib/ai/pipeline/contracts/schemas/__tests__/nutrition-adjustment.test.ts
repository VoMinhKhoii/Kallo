import { describe, expect, it } from 'vitest';
import { toJSONSchema } from 'zod';
import {
  ingredientLlmNutritionSchema,
  nutritionAdjustmentSchema,
} from '@/lib/ai/pipeline/contracts/schemas/nutrition-adjustment';

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

  it('accepts compact optional nutrition IDs', () => {
    const result = nutritionAdjustmentSchema.safeParse({
      mealItems: [
        {
          mealItemId: 'm1',
          mealItemName: 'cơm',
          ingredients: [{ ...validIngredient, ingredientId: 'i1' }],
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
  it('produces valid JSON schema for ingredientLlmNutritionSchema', () => {
    const jsonSchema = toJSONSchema(ingredientLlmNutritionSchema);
    expect(jsonSchema).toBeDefined();
    expect(jsonSchema.type).toBe('object');
  });
});
