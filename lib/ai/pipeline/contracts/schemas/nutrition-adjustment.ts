import { z } from 'zod';
import { boundedEstimateSchema } from './bounded-estimate';

// ---------------------------------------------------------------------------
// LLM Call 2: Cooking-adjusted bounded nutrition schema, 4 macros (v1 shape)
// ---------------------------------------------------------------------------
//
// The v2 grounded path's Call 2 shape is `./grounded-estimation.ts`; this one
// is read by `pipeline/legacy/` and the v1-shaped debug harness at
// `app/api/analyze-meal/debug/`.
//
// Contract (2026-05-13): the LLM emits absolute {low, mid, high} per macro,
// but only `fatG` actually flows downstream for **matched** ingredients.
// `resolveIngredientMacros` in `lib/ai/pipeline/resolve/macro-resolution.ts`:
//   - emits flat triples (low=mid=high) at the DB-anchored base for proteinG
//     and carbohydrateG;
//   - keeps the LLM's fatG triple subject to a 3× hallucination guard
//     (clamps to the nearest guard bound when the estimate falls outside it);
//   - derives caloriesKcal from the macro identity 4P + 4C + 9F, so only
//     fat's spread (when present) drives goal-adjustment.
// The LLM's emitted P/C/kcal for matched ingredients are accepted by the
// schema (so the model isn't forced to think about them) but server-overridden.
//
// For **unmatched** ingredients (no DB row): the LLM's P/C/F triples flow
// through verbatim, kcal is derived from the macro identity, and a hard
// density clamp (`MAX_KCAL_PER_100G` from `lib/ai/pipeline/contracts/nutrition-limits.ts`) scales the
// whole triple down if it exceeds the physical ceiling.

/**
 * LLM Call 2 produces bounded estimates for the 4 macros only:
 * calories, protein, carbs, fat.
 * All other nutrients (including fiber) pass through as DB mid values.
 */
export const ingredientLlmNutritionSchema = z.object({
  ingredientId: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Optional pass-through of the decomposition ingredientId; runtime reconciles by name when omitted.'
    ),
  ingredientName: z
    .string()
    .describe('Must match the ingredient name from decomposition'),
  caloriesKcal: boundedEstimateSchema.describe(
    'Calories in kcal for the as-eaten portion (NOT per 100g).'
  ),
  proteinG: boundedEstimateSchema.describe(
    'Protein in grams for the as-eaten portion (NOT per 100g).'
  ),
  carbohydrateG: boundedEstimateSchema.describe(
    'Carbohydrates in grams for the as-eaten portion (NOT per 100g).'
  ),
  fatG: boundedEstimateSchema.describe(
    'Fat in grams for the as-eaten portion (NOT per 100g).'
  ),
});

export const mealItemNutritionSchema = z.object({
  mealItemId: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Optional pass-through of the decomposition mealItemId; runtime reconciles by name when omitted.'
    ),
  mealItemName: z
    .string()
    .describe('Must match the meal item name from decomposition'),
  ingredients: z
    .array(ingredientLlmNutritionSchema)
    .min(1)
    .describe(
      'Bounded nutrition per ingredient (4 macros), adjusted for cooking method and portion'
    ),
});

export const nutritionAdjustmentSchema = z.object({
  mealItems: z
    .array(mealItemNutritionSchema)
    .min(1)
    .describe('Bounded nutrition for each meal item from decomposition'),
});
