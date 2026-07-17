import { z } from 'zod';
import { boundedEstimateSchema } from './schemas';

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
 * Closed-enum size cue the user typed alongside a count/unit ("nhỏ"/"vừa"/
 * "lớn"/"small"/"medium"/"large"). NLP-shaped: the LLM only classifies the
 * word; the server-side portion resolver maps it to a low/mid/high grams band.
 */
export const sizeModifierSchema = z.enum(['small', 'medium', 'large']);

/**
 * Structured explicit mass the user typed verbatim (e.g. "250gr ... cân sống").
 * Extraction ONLY — the LLM must NOT invent this when the user gave no weight.
 * `basis` mirrors `stateHint`'s raw/cooked axis so the resolver honors a raw
 * weight 1:1 with no cooking-yield fudge.
 */
export const explicitMassSchema = z
  .object({
    grams: z
      .number()
      .positive()
      .finite()
      .describe('Verbatim mass in grams the user typed (e.g. 250 for "250gr").'),
    basis: z
      .enum(['raw', 'cooked'])
      .describe(
        '"raw" when the weight was measured before cooking ("cân sống"); "cooked" for as-eaten.'
      ),
  })
  .strict();

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
    // ---- Structured quantity evidence (Phase 3, NLP-shaped) --------------
    // Extraction ONLY. The LLM never computes grams here — the server-side
    // portion resolver turns (count × unitToken × sizeModifier) into a grams
    // band scoped to a food concept + locale. Omit every field the user did
    // not actually express.
    count: z
      .number()
      .positive()
      .finite()
      .optional()
      .describe(
        'Numeric count the user gave for this item/ingredient (e.g. 2 for "2 bánh bao", 3 for "3 lát"). Omit when no count was stated.'
      ),
    unitToken: z
      .string()
      .min(1)
      .max(24)
      .optional()
      .describe(
        'Verbatim unit/counter word the count applied to, in the user\'s language ("bánh bao", "cái", "lát", "slice", "cup", "tô", "xiên"). Omit when no unit word was used.'
      ),
    sizeModifier: sizeModifierSchema
      .optional()
      .describe(
        'Size cue the user typed for the unit ("nhỏ"→small, "vừa"→medium, "lớn"→large, "small"/"large"). Omit when unspecified.'
      ),
    explicitMass: explicitMassSchema
      .optional()
      .describe(
        'Set ONLY when the user typed an explicit weight (e.g. "250gr ức gà cân sống" → {grams:250, basis:"raw"}). Never invent a mass.'
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
export type SizeModifier = z.infer<typeof sizeModifierSchema>;
export type ExplicitMass = z.infer<typeof explicitMassSchema>;
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
    // `.positive().finite()` is genuinely enforcing: Zod's `schema.parse()`
    // (run post-provider-parse in gemini.ts) rejects 0/negative/NaN/Infinity
    // grams and THROWS, which routes the whole call into the existing
    // `withRetry` parse-retry path — instead of the old silent grams=1
    // fallback in bridge.ts. We enforce at the Zod layer rather than relying
    // on the provider JSON schema because Gemini's `responseJsonSchema` does
    // not reliably honor `exclusiveMinimum` (same class of limitation that
    // forced the cheat-slider `.max()` drop above).
    grams: z
      .number()
      .positive()
      .finite()
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
    .describe('The single best-guess level; the slider starts here.'),
  // No .max() here: Gemini's responseJsonSchema rejects a schema whose nested
  // bounded arrays unroll to too many fields. sliders.max(4) × anchors.max(11)
  // × the 6-property anchor object tripped that limit with 400 INVALID_ARGUMENT.
  // Capping anchor count is non-essential (the prompt asks for sparse keypoints
  // incl. level 0 and 10), so we drop the upper bound and keep the .min(2) floor.
  anchors: z
    .array(cheatSliderAnchorSchema)
    .min(2)
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
