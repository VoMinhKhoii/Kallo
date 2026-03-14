import { z } from 'zod';

// ---------------------------------------------------------------------------
// LLM Call 1: Meal decomposition schema
// ---------------------------------------------------------------------------

export const decomposedIngredientSchema = z.object({
  name: z
    .string()
    .describe(
      'Vietnamese ingredient name (e.g., "bún", "thịt bò", "nước dùng")'
    ),
  estimatedGrams: z
    .number()
    .positive()
    .describe('Estimated weight in grams for the portion described'),
  cookingMethod: z
    .string()
    .nullable()
    .describe(
      'Cooking method if identifiable (e.g., "luộc", "chiên", "kho", "nướng"), null if raw or unclear'
    ),
  userFacingUnit: z
    .string()
    .nullable()
    .describe(
      'Original unit from user input for display (e.g., "1 chén", "2 miếng"), null if not specified'
    ),
});

export const decomposedMealItemSchema = z.object({
  name: z
    .string()
    .describe(
      'User-facing meal item name (e.g., "bún bò Huế", "cơm", "thịt kho")'
    ),
  ingredients: z
    .array(decomposedIngredientSchema)
    .min(1)
    .describe('Internal ingredient breakdown for DB matching'),
});

export const mealDecompositionSchema = z.object({
  isFood: z
    .boolean()
    .describe(
      'Whether the input describes recognizable food or meal items. false for gibberish, non-food, or unrelated text.'
    ),
  mealItems: z
    .array(decomposedMealItemSchema)
    .describe(
      'Meal decomposed into user-facing items with ingredient breakdown. Empty array when isFood is false.'
    ),
  mealSlot: z
    .enum(['breakfast', 'brunch', 'lunch', 'dinner', 'snack'])
    .nullable()
    .describe(
      'Classified meal slot if confident (Sáng→breakfast, Trưa→lunch, Tối→dinner, Bữa phụ→snack, Brunch→brunch), null if uncertain'
    ),
});

// ---------------------------------------------------------------------------
// LLM Call 2: Cooking-adjusted bounded nutrition schema (4 macros only)
// ---------------------------------------------------------------------------

/**
 * Bounded estimate shape — used for both JSON schema generation and runtime parsing.
 * Note: Gemini's responseJsonSchema cannot include transforms, so we use a plain
 * object schema for JSON schema generation and normalize after parsing.
 */
export const boundedEstimateSchema = z.object({
  low: z.number().describe('Conservative lower bound'),
  mid: z.number().describe('Most likely estimate'),
  high: z.number().describe('Conservative upper bound'),
});

/**
 * Normalize a bounded estimate: re-sort if ordering is violated.
 * Logs the original values when re-sorting occurs for observability.
 */
export function normalizeBoundedEstimate(raw: {
  low: number;
  mid: number;
  high: number;
}): { low: number; mid: number; high: number } {
  if (raw.low <= raw.mid && raw.mid <= raw.high) {
    return raw;
  }

  const sorted = [raw.low, raw.mid, raw.high].sort((a, b) => a - b);
  console.warn(
    `[ai/schemas] Re-sorted bounded estimate: {low:${raw.low}, mid:${raw.mid}, high:${raw.high}} → {low:${sorted[0]}, mid:${sorted[1]}, high:${sorted[2]}}`
  );
  return { low: sorted[0], mid: sorted[1], high: sorted[2] };
}

/**
 * LLM Call 2 produces bounded estimates for the 4 macros only:
 * calories, protein, carbs, fat.
 * All other nutrients (including fiber) pass through as DB mid values.
 */
export const ingredientLlmNutritionSchema = z.object({
  ingredientName: z
    .string()
    .describe('Must match the ingredient name from decomposition'),
  caloriesKcal: boundedEstimateSchema.describe('Calories in kcal'),
  proteinG: boundedEstimateSchema.describe('Protein in grams'),
  carbohydrateG: boundedEstimateSchema.describe('Carbohydrates in grams'),
  fatG: boundedEstimateSchema.describe('Fat in grams'),
});

export const mealItemNutritionSchema = z.object({
  mealItemName: z
    .string()
    .describe('Must match the meal item name from decomposition'),
  ingredients: z
    .array(ingredientLlmNutritionSchema)
    .min(1)
    .describe(
      'Bounded nutrition per ingredient (5 key nutrients), adjusted for cooking method and portion'
    ),
});

export const nutritionAdjustmentSchema = z.object({
  mealItems: z
    .array(mealItemNutritionSchema)
    .min(1)
    .describe('Bounded nutrition for each meal item from decomposition'),
});
