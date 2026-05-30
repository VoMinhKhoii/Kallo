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

// ===========================================================================
// V2 PIPELINE SCHEMAS
// ===========================================================================
//
// V2 splits the pipeline so Call 1 is pure decomposition (no grams) and Call
// 2 ("grounded estimation") receives matched DB candidates, then emits:
//   - a CRAG-style match verdict per ingredient,
//   - grams that are correctly scoped to the selected candidate's state,
//   - macros with the existing prep-notes-aware band logic.
//
// Schemas are additive: v1 (above) is unchanged and remains active when
// PIPELINE_V2_ENABLED=false (the default). Cutover plan in
// /root/.claude/plans/i-need-the-ai-sorted-tome.md.
// ---------------------------------------------------------------------------

/**
 * Closed-enum hint extracted from the user's text indicating how the weight
 * (when later estimated in Call 2) should relate to cooking state. `raw_weight`
 * is the "cân sống" / "raw weight" / "before cooking" pattern. `cooked_weight`
 * is the as-eaten default. `unspecified` means the user didn't say — Call 2
 * infers from cooking method + cuisine priors.
 */
export const stateHintSchema = z.enum([
  'raw_weight',
  'cooked_weight',
  'unspecified',
]);

/**
 * V2 Call 1 ingredient — pure decomposition. Notably absent: `grams`,
 * `weightBasis`, `expectedState`. Those move to Call 2 where the LLM sees
 * the matched DB row and can reason with full context (eliminates the
 * Call-1-grams-ambiguity that forced the convertCookedToRaw fudge in v1).
 *
 * `cookingMethod` stays on the dish; per-ingredient override is rare and
 * lives on `decomposedIngredientV2Schema.cookingMethod` for mixed-state
 * dishes.
 */
export const decomposedIngredientV2Schema = z
  .object({
    rawName: z
      .string()
      .min(1)
      .describe(
        'Ingredient name in the user\'s language as written or inferred from the user input (e.g., "ức gà", "chicken breast", "nước dùng").'
      ),
    canonicalName: z
      .string()
      .min(1)
      .describe(
        'Disambiguated food-composition vocabulary name used for DB matching.'
      ),
    cookingMethod: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Per-ingredient cooking method override for mixed-state dishes; otherwise inherit from the dish.'
      ),
    stateHint: stateHintSchema
      .optional()
      .describe(
        'Hint extracted from the user\'s text. "raw_weight" when the user explicitly said the weight was measured before cooking ("cân sống", "raw weight", "before cooking"); "cooked_weight" when they pinned to as-eaten ("đã nấu xong cân", "after cooking"); "unspecified" or omit when neither — Call 2 infers from cooking method.'
      ),
    stateNote: z
      .string()
      .max(80)
      .optional()
      .describe(
        'Free-form short verbatim user phrase that informed `stateHint`. Helps Call 2 disambiguate unusual phrasings. Optional.'
      ),
    prepNotes: z
      .array(z.string().min(1).max(60))
      .max(6)
      .optional()
      .describe(
        'Short verbatim user-typed preparation modifiers that change macro density for the SAME food (NOT identity changes, NOT quantity, NOT weight basis, NOT ingredient removals). Examples: ["bỏ da", "bỏ mỡ"], ["nước trong"], ["không dầu"], ["extra oil"]. Omit when there is nothing to add.'
      ),
  })
  .strict();

export const decomposedDishV2Schema = z
  .object({
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
        "Free-form cooking method for the dish in the user's language; per-ingredient cookingMethod overrides for mixed-state dishes."
      ),
    cuisineNote: z
      .string()
      .optional()
      .describe('Optional regional/style note for disambiguation.'),
    ingredients: z
      .array(decomposedIngredientV2Schema)
      .min(1)
      .describe('Internal ingredient breakdown for DB matching'),
  })
  .strict();

export const mealDecompositionV2Schema = z.object({
  isFood: z
    .boolean()
    .describe(
      'Whether the input describes recognizable food or meal items. false for gibberish, non-food, or unrelated text.'
    ),
  mealItems: z
    .array(decomposedDishV2Schema)
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

export type StateHint = z.infer<typeof stateHintSchema>;
export type DecomposedIngredientV2 = z.infer<
  typeof decomposedIngredientV2Schema
>;
export type DecomposedDishV2 = z.infer<typeof decomposedDishV2Schema>;
export type MealDecompositionV2 = z.infer<typeof mealDecompositionV2Schema>;

/**
 * V2 Call 2 (grounded estimation) per-ingredient output. The CRAG verdict
 * decides whether the matched candidate is used; on reject, the runtime
 * routes through the unmatched path (LLM macros only, no DB anchoring).
 *
 * `selectedCandidateId` is the canonical verdict signal:
 *   - "c1"…"cN" — accept that candidate's facts as the DB anchor.
 *   - "none"    — all candidates are categorically wrong; treat as unmatched.
 *   - omitted   — only valid when the server passed zero candidates
 *                 (auto-unmatched path).
 *
 * `grams` is the LLM's portion estimate, now state-correct because the LLM
 * saw the selected candidate's `db_state`. Server scales DB per_100g ×
 * grams / 100 with NO yield-factor fudge.
 */
export const groundedIngredientEstimateSchema = z
  .object({
    ingredientName: z
      .string()
      .describe('Must match the ingredient name from decomposition.'),
    selectedCandidateId: z
      .union([z.string().min(1), z.literal('none')])
      .optional()
      .describe(
        'CRAG verdict: candidate id ("c1"…) to accept that match, or "none" to reject all candidates and route through unmatched path. Omit only when the input had no candidates.'
      ),
    rejectReason: z
      .string()
      .max(120)
      .optional()
      .describe(
        'When selectedCandidateId="none", a short reason (e.g. "category mismatch — ức gà ≠ generic chicken meat"). Used for telemetry, not user-facing.'
      ),
    grams: z
      .number()
      .describe(
        "As-eaten or raw mass in grams, scoped to the selected candidate's state when present. Must be > 0."
      ),
    caloriesKcal: boundedEstimateSchema.describe(
      'Calories in kcal for the as-eaten portion. Server overrides for matched ingredients via the macro identity 4P + 4C + 9F.'
    ),
    proteinG: boundedEstimateSchema.describe(
      'Protein in grams for the as-eaten portion. Server-anchored to base unless prepNotes is non-empty.'
    ),
    carbohydrateG: boundedEstimateSchema.describe(
      'Carbohydrates in grams for the as-eaten portion. Server-anchored to base unless prepNotes is non-empty.'
    ),
    fatG: boundedEstimateSchema.describe(
      'Fat in grams for the as-eaten portion. Always LLM-driven (cooking-method effect); subject to hallucination guard.'
    ),
  })
  .strict();

export const groundedMealItemSchema = z
  .object({
    mealItemName: z
      .string()
      .describe('Must match the meal item name from decomposition.'),
    ingredients: z.array(groundedIngredientEstimateSchema).min(1),
  })
  .strict();

export const groundedEstimationSchema = z.object({
  mealItems: z.array(groundedMealItemSchema).min(1),
});

export type GroundedIngredientEstimate = z.infer<
  typeof groundedIngredientEstimateSchema
>;
export type GroundedMealItem = z.infer<typeof groundedMealItemSchema>;
export type GroundedEstimation = z.infer<typeof groundedEstimationSchema>;

// ===========================================================================
// CHEAT-MEAL SLIDER ESTIMATE SCHEMA
// ===========================================================================
//
// A cheat meal (buffet, BBQ, a box of donuts) is impossible to itemize, so we
// skip decomposition entirely. A reasoning-enabled model turns the occasion
// into a few labeled 0–10 sliders the user places themselves on. Each macro
// slider owns ONE nutrient axis and carries sparse, context-interpretable
// anchors; the optional drinks slider is the one multi-nutrient axis (soda→
// carbs, creamy→fat, alcohol→ethanol). The client/server resolve final
// nutrition from the chosen levels via `lib/cheat/slider-nutrition.ts`.

export const cheatSliderKeySchema = z.enum([
  'protein',
  'carbs',
  'fat',
  'drinks',
]);

export const cheatSliderAnchorSchema = z.object({
  level: z
    .number()
    .min(0)
    .max(10)
    .describe('Position on the 0–10 slider for this keypoint.'),
  label: z
    .string()
    .min(1)
    .max(80)
    .describe(
      'Short, context-interpretable scenario in the user\'s language, e.g. "vài miếng nigiri", "ba chỉ + đồ chiên". NOT a generic "a little/normal/a lot".'
    ),
  proteinG: z
    .number()
    .min(0)
    .optional()
    .describe('Protein grams at this level. Only on the protein slider.'),
  carbohydrateG: z
    .number()
    .min(0)
    .optional()
    .describe(
      'Carbohydrate grams at this level. On the carbs slider, and on the drinks slider for sugary drinks.'
    ),
  fatG: z
    .number()
    .min(0)
    .optional()
    .describe(
      'Fat grams at this level. On the fat slider, and on the drinks slider for creamy drinks.'
    ),
  alcoholG: z
    .number()
    .min(0)
    .optional()
    .describe('Ethanol grams at this level. Only on the drinks slider.'),
});

export const cheatSliderSchema = z.object({
  key: cheatSliderKeySchema,
  label: z
    .string()
    .min(1)
    .max(40)
    .describe('Localized dial name, e.g. "Thịt / hải sản", "Độ béo".'),
  defaultLevel: z
    .number()
    .min(0)
    .max(10)
    .describe("The single best-guess level; the slider starts here."),
  anchors: z
    .array(cheatSliderAnchorSchema)
    .min(2)
    .max(11)
    .describe(
      'Sparse keypoints; MUST include level 0 and level 10. Grams between anchors are interpolated.'
    ),
});

export const cheatClarifyingQuestionSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .max(160)
    .describe('One short question, asked only when the occasion is too vague.'),
  options: z
    .array(z.string().min(1).max(40))
    .min(2)
    .max(5)
    .optional()
    .describe('Optional answer chips.'),
});

export const cheatEstimateSchema = z.object({
  sliders: z
    .array(cheatSliderSchema)
    .max(4)
    .describe(
      'The macro sliders (protein, carbs, fat) plus an optional drinks slider when plausible. Empty/loose only when clarifyingQuestion is set.'
    ),
  rationale: z
    .string()
    .max(280)
    .describe(
      'A warm, ≤280-char line showing the app understood the occasion. No clinical tone, no judgement.'
    ),
  mealSlot: z
    .enum(['breakfast', 'brunch', 'lunch', 'dinner', 'snack'])
    .nullable()
    .describe('Inferred meal slot, or null if uncertain.'),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe('Overall confidence in the occasion estimate.'),
  clarifyingQuestion: cheatClarifyingQuestionSchema
    .optional()
    .describe(
      'Set ONLY when the free-text is too vague to author sensible anchors. The client asks it, then re-calls with the answer.'
    ),
});

export type CheatEstimate = z.infer<typeof cheatEstimateSchema>;
