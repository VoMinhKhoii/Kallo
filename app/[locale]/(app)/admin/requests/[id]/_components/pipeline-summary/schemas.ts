import { z } from 'zod';

/** v1 Call-1 ingredient: a display `name` plus a Call-1 gram estimate. */
const v1IngredientSchema = z.object({
  name: z.string(),
  estimatedGrams: z.number().nullable().optional(),
  cookingMethod: z.string().nullable().optional(),
  userFacingUnit: z.string().nullable().optional(),
});

/**
 * v2 Call-1 ingredient. Two differences that made every v2 trace fail to
 * parse here: the field is `rawName`/`canonicalName` rather than `name`, and
 * there is no `estimatedGrams` at all — v2 moved mass to the server portion
 * resolver and Call 2, so Call 1 emits none. Normalizing to the v1 shape
 * keeps the whole summary on one representation.
 */
const v2IngredientSchema = z
  .object({
    rawName: z.string(),
    canonicalName: z.string().optional(),
    cookingMethod: z.string().nullable().optional(),
  })
  .transform((ing) => ({
    name: ing.rawName || ing.canonicalName || '',
    estimatedGrams: null,
    cookingMethod: ing.cookingMethod ?? null,
    userFacingUnit: null,
  }));

// v1 first: a v2 ingredient has no `name` so it can never satisfy v1, and a
// v1 ingredient has no `rawName` so it can never satisfy v2. The union is
// unambiguous in both directions.
const ingredientSchema = z.union([v1IngredientSchema, v2IngredientSchema]);

export const decompositionSchema = z.object({
  isFood: z.boolean().optional(),
  mealSlot: z.string().nullable().optional(),
  languageMetadata: z
    .object({
      inputLanguage: z.enum(['en', 'vi', 'mixed', 'unknown']).nullable(),
      outputLanguage: z.enum(['en', 'vi']).nullable(),
      guardReason: z.string(),
      guardSeverity: z.enum(['info', 'warning', 'error']),
      guardPassed: z.boolean(),
      retryCount: z.number().int().min(0),
    })
    .optional(),
  mealItems: z
    .array(
      z.object({
        name: z.string(),
        ingredients: z.array(ingredientSchema).default([]),
      })
    )
    .default([]),
});

export const matchedSchema = z.object({
  ingredientName: z.string(),
  foodCompositionId: z.string().nullable().optional(),
  matchedName: z.string(),
  similarity: z.number(),
  confidence: z.enum(['high', 'medium', 'low']),
  matchType: z.enum(['vector', 'fuzzy']).optional(),
  source: z.enum(['fao', 'usda']).optional(),
  latencyMs: z.number().optional(),
  viaAlias: z.boolean().optional(),
});
export const unmatchedSchema = z.object({
  ingredientName: z.string(),
  mealContext: z.string().nullable().optional(),
});
export const matchingSchema = z.object({
  matched: z.array(matchedSchema).default([]),
  unmatched: z.array(unmatchedSchema).default([]),
});

export const assemblyMacroSchema = z
  .object({
    mid: z.number().nullable().optional(),
  })
  .nullable()
  .optional();

export const assemblyMealItemSchema = z.object({
  name: z.string(),
  displayedNutrition: z
    .object({
      caloriesKcal: z.number().nullable().optional(),
      proteinG: z.number().nullable().optional(),
      carbohydrateG: z.number().nullable().optional(),
      fatG: z.number().nullable().optional(),
    })
    .partial()
    .optional(),
  boundedNutrition: z
    .object({
      caloriesKcal: assemblyMacroSchema,
      proteinG: assemblyMacroSchema,
      carbohydrateG: assemblyMacroSchema,
      fatG: assemblyMacroSchema,
    })
    .partial()
    .optional(),
});
export const assemblySchema = z.object({
  mealItems: z.array(assemblyMealItemSchema).default([]),
  displayedNutrition: z
    .object({
      caloriesKcal: z.number().nullable().optional(),
      proteinG: z.number().nullable().optional(),
      carbohydrateG: z.number().nullable().optional(),
      fatG: z.number().nullable().optional(),
    })
    .partial()
    .optional(),
});

// ---------------------------------------------------------------------------
