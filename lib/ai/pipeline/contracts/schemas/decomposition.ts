import { z } from 'zod';

// ---------------------------------------------------------------------------
// LLM Call 1: Dish-wrapped meal decomposition schema (v1 shape)
// ---------------------------------------------------------------------------
//
// Call 1 emits grams here. The v2 grounded path deliberately does not — it
// moves grams into Call 2, where the LLM sees the matched DB row. See
// `./decomposition-v2.ts`. This shape is read by `pipeline/legacy/` (the
// PIPELINE_V2_ENABLED=false fallback) and the v1-shaped debug harness at
// `app/api/analyze-meal/debug/`.

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
