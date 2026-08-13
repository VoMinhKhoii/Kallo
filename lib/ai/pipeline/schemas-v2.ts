import { z } from 'zod';
import { isRefusePctSchemaEnabled } from './config/prompt-ablation-flags';
import {
  explicitMassSchema,
  sizeModifierSchema,
  stateHintSchema,
} from './portion-evidence-schemas';
import { boundedEstimateSchema } from './schemas';

/**
 * V2 Call 1 ingredient — pure decomposition. Notably absent: `grams`,
 * `weightBasis`, `expectedState`. Those move to Call 2 where the LLM sees
 * the matched DB row and can reason with full context (eliminates the
 * Call-1-grams-ambiguity that forced the convertCookedToRaw fudge in v1).
 *
 * `cookingMethod` defaults from the dish. Mixed-method dishes must use the
 * per-ingredient override on `decomposedIngredientV2Schema.cookingMethod`.
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
        'Actual cooking method for this ingredient when it differs from the dish default. Use this override for every differing ingredient in a mixed-method dish (for example: boiled noodles, fried tofu, raw herbs). Otherwise omit it and inherit the dish method.'
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
      .nonnegative()
      .finite()
      .optional()
      .describe(
        'Numeric count the user gave for this item/ingredient (e.g. 2 for "2 bánh bao", 3 for "3 lát"). 0 is VALID and meaningful — extract it verbatim when the user typed zero ("0 fried chicken"); the server clarifies. Omit only when no count was stated.'
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
        'Set ONLY when the user typed an explicit weight. `basis` is the physical mass basis: gross_as_served for a named bone-in/shell-on object, edible for a boneless/peeled/fillet form, otherwise unknown. Cooking state belongs in stateHint. Never invent a mass.'
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
        "Free-form default cooking method for the dish in the user's language. It applies only to ingredients without their own cookingMethod override."
      ),
    cuisineNote: z
      .string()
      .optional()
      .describe('Optional regional/style note for disambiguation.'),
    vesselToken: z
      .string()
      .min(1)
      .max(16)
      .optional()
      .describe(
        'Verbatim vessel/container word the WHOLE dish was served in ("tô", "chén", "dĩa", "ly", "bowl", "plate", "cup", "mug"). Set only when the user quantified the DISH by a vessel; never invent.'
      ),
    vesselSize: sizeModifierSchema
      .optional()
      .describe(
        'Size cue attached to the dish vessel word ("tô nhỏ"→small). Omit when unspecified.'
      ),
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
 * The default schema asks for edible `grams`. REFUSE_PCT_SCHEMA replaces that
 * field with ordered `grossG`, `refusePct`; the server derives edible mass.
 * Both variants follow the selected candidate's `db_state` with no yield
 * fudge.
 */
export function buildGroundedIngredientEstimateSchema(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
) {
  const massFields = isRefusePctSchemaEnabled(env)
    ? {
        grossG: z
          .number()
          .positive()
          .finite()
          .describe(
            'Whole as-served mass in grams INCLUDING bone, shell, rind, or other refuse not eaten. Uses the same raw-vs-cooked basis rules as grams. Must be > 0.'
          ),
        refusePct: z
          .number()
          .int()
          .min(0)
          .max(80)
          .describe(
            'REQUIRED integer share of grossG that is inedible bone, shell, or rind. Emit explicit 0 for boneless/shell-off foods; never omit.'
          ),
      }
    : {
        // `.positive().finite()` is genuinely enforcing: Zod's
        // `schema.parse()` (run post-provider-parse in gemini.ts) rejects
        // 0/negative/NaN/Infinity grams and THROWS, which routes the whole
        // call into the existing `withRetry` parse-retry path — instead of
        // the old silent grams=1 fallback in bridge.ts. We enforce at the Zod
        // layer rather than relying on the provider JSON schema because
        // Gemini's `responseJsonSchema` does not reliably honor
        // `exclusiveMinimum`.
        grams: z
          .number()
          .positive()
          .finite()
          .describe(
            "As-eaten or raw mass in grams, scoped to the selected candidate's state when present. Must be > 0."
          ),
      };

  return z
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
      ...massFields,
      // ALWAYS REQUIRED — the D3 "slimmed matched output" optionality is
      // deliberately reverted. It saved Call-2 output tokens for matched rows
      // (the server overwrites P/C/kcal from the DB anyway), but the same
      // optionality applied on the UNMATCHED path where these numbers are the
      // only source: prod meal "mì gói sứa" had its noodles' carbohydrateG
      // simply omitted, ZERO_TRIPLE'd, and persisted at C:0g / 412 kcal.
      // Requiring the fields puts enforcement in the PROVIDER's JSON decoder
      // (zod → toJSONSchema emits them in `required`, so Gemini structurally
      // cannot omit them); zod parse remains the backstop. A genuine zero is a
      // valid value — plausibility telemetry, not schema, judges plausibility.
      caloriesKcal: boundedEstimateSchema.describe(
        'Calories in kcal for the as-eaten portion. ALWAYS emit. For matched ingredients the server re-derives kcal from the DB anchor; for unmatched ingredients your value is the truth.'
      ),
      proteinG: boundedEstimateSchema.describe(
        'Protein in grams. ALWAYS emit; 0 is a valid value for genuinely protein-free foods. For matched ingredients the server anchors to the DB base.'
      ),
      carbohydrateG: boundedEstimateSchema.describe(
        'Carbohydrates in grams. ALWAYS emit; 0 is a valid value for genuinely carb-free foods. For matched ingredients the server anchors to the DB base.'
      ),
      fatG: boundedEstimateSchema.describe(
        'Fat in grams for the as-eaten portion. ALWAYS emit — always LLM-driven (cooking-method effect); subject to hallucination guard.'
      ),
    })
    .strict();
}

/** Build-time-selected Call-2 ingredient schema; REFUSE_PCT_SCHEMA defaults OFF. */
export const groundedIngredientEstimateSchema =
  buildGroundedIngredientEstimateSchema();

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
