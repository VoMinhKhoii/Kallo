import { z } from 'zod';

// ---------------------------------------------------------------------------
// LLM Call 1: Dish-wrapped meal decomposition schema
// ---------------------------------------------------------------------------

export const ambiguityFlagSchema = z.enum([
  'multiple_dish_interpretations',
  'unspecified_quantity',
  'cross_cuisine_ingredient',
  'state_inferred_no_method',
]);

export const decomposedIngredientSchema = z
  .object({
    ingredientId: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Optional legacy per-ingredient ID. Runtime owns and normalizes compact run-scoped IDs (§0.1).'
      ),
    rawName: z
      .string()
      .min(1)
      .describe(
        'Ingredient name in the user\'s language as written or inferred from the user input (e.g., "bún", "chicken breast", "nước dùng").'
      ),
    canonicalName: z
      .string()
      .min(1)
      .describe(
        'Disambiguated food-composition vocabulary name used for DB matching.'
      ),
    grams: z
      // Zod v4 z.number() already rejects Infinity by default — .finite() is
      // a no-op there. We deliberately allow zero/negative grams through
      // parse so Step 4 anomaly detection (validation.ts) can attribute
      // them as `implausible_grams` instead of a generic parse_error.
      .number()
      .describe(
        'As-eaten mass in grams. The model converts colloquial portions to grams; runtime has no unit field.'
      ),
    expectedState: z
      .enum(['raw', 'cooked'])
      .optional()
      .describe(
        'Optional per-ingredient raw/cooked state. Runtime derives from dish cookingMethod when omitted.'
      ),
    weightBasis: z
      .enum(['raw', 'as_eaten'])
      .optional()
      .describe(
        'Optional weighing reference for `grams`. Emit "raw" ONLY when the user explicitly says the weight was taken before cooking (e.g. "cân sống", "raw weight", "before cooking", "pre-cooked weight"). Omit otherwise; runtime treats absent as "as_eaten".'
      ),
    prepNotes: z
      .array(z.string().min(1).max(60))
      .max(6)
      .optional()
      .describe(
        'Optional short user-typed preparation modifiers that change macro density for the SAME food (NOT identity changes, NOT quantity, NOT weight basis, NOT ingredient removals). Keep verbatim, preserve diacritics. Examples: ["bỏ da", "bỏ mỡ"], ["nước trong"], ["không dầu"], ["extra oil"], ["low-fat"], ["dry-fried"]. Omit when there is nothing to add.'
      ),
    ambiguityFlags: z
      .array(ambiguityFlagSchema)
      .optional()
      .describe(
        'Closed-enum ambiguity side channel for aggregate logging; not a routing input.'
      ),
  })
  .strict();

export const decomposedDishSchema = z
  .object({
    mealItemId: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Optional legacy per-meal-item ID. Runtime owns and normalizes compact run-scoped IDs (§0.1).'
      ),
    name: z
      .string()
      .min(1)
      .describe(
        'User-facing dish name (e.g., "bún bò Huế", "cơm", "thịt kho").'
      ),
    cookingMethod: z
      .string()
      .min(1)
      .describe(
        "Free-form cooking method for the dish in the user's language; per-ingredient expectedState is the source of truth when present."
      ),
    cuisineNote: z
      .string()
      .optional()
      .describe('Optional regional/style note for disambiguation.'),
    ingredients: z
      .array(decomposedIngredientSchema)
      .min(1)
      .describe('Internal ingredient breakdown for DB matching'),
  })
  .strict();

export const decomposedMealItemSchema = decomposedDishSchema;

export const mealDecompositionSchema = z.object({
  isFood: z
    .boolean()
    .describe(
      'Whether the input describes recognizable food or meal items. false for gibberish, non-food, or unrelated text.'
    ),
  mealItems: z
    .array(decomposedDishSchema)
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

export type AmbiguityFlag = z.infer<typeof ambiguityFlagSchema>;
export type DecomposedIngredient = z.infer<typeof decomposedIngredientSchema>;
export type DecomposedDish = z.infer<typeof decomposedDishSchema>;
export type MealDecomposition = z.infer<typeof mealDecompositionSchema>;

// ---------------------------------------------------------------------------
// LLM Call 2: Cooking-adjusted bounded nutrition schema (4 macros only)
// ---------------------------------------------------------------------------
//
// Contract (2026-05-13): the LLM emits absolute {low, mid, high} per macro,
// but only `fatG` actually flows downstream for **matched** ingredients.
// `resolveIngredientMacros` in `lib/ai/pipeline/nutrition.ts`:
//   - emits flat triples (low=mid=high) at the DB-anchored base for proteinG
//     and carbohydrateG;
//   - keeps the LLM's fatG triple subject to a 3× hallucination guard
//     (falls back to a flat triple at base.fatG when the guard fires);
//   - derives caloriesKcal from the macro identity 4P + 4C + 9F, so only
//     fat's spread (when present) drives goal-adjustment.
// The LLM's emitted P/C/kcal for matched ingredients are accepted by the
// schema (so the model isn't forced to think about them) but server-overridden.
//
// For **unmatched** ingredients (no DB row): the LLM's P/C/F triples flow
// through verbatim, kcal is derived from the macro identity, and a hard
// density clamp (`MAX_KCAL_PER_100G` from `lib/ai/constants.ts`) scales the
// whole triple down if it exceeds the physical ceiling.

/**
 * Bounded estimate shape — used for both JSON schema generation and runtime
 * parsing. Note: Gemini's responseJsonSchema cannot include transforms, so
 * we use a plain object schema for JSON schema generation and normalize
 * after parsing.
 */
export const boundedEstimateSchema = z.object({
  low: z.number().min(0).describe('Conservative lower bound'),
  mid: z
    .number()
    .min(0)
    .describe(
      'Most likely estimate. For DB-matched ingredients the server overrides this with the DB-anchored base.'
    ),
  high: z.number().min(0).describe('Conservative upper bound'),
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
