import { z } from 'zod';
import { boundedEstimateSchema } from './bounded-estimate';

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
 * The schema asks for ordered `grossG`, `refusePct`; the server derives
 * edible mass = grossG × (1 − refusePct/100). Both fields follow the selected
 * candidate's `db_state` with no yield fudge.
 */
export function buildGroundedIngredientEstimateSchema() {
  // `.positive().finite()` is genuinely enforcing: Zod's `schema.parse()`
  // (run post-provider-parse in gemini.ts) rejects 0/negative/NaN/Infinity
  // masses and THROWS, which routes the whole call into the existing
  // `withRetry` parse-retry path — instead of the old silent grams=1 fallback
  // in bridge.ts. We enforce at the Zod layer rather than relying on the
  // provider JSON schema because Gemini's `responseJsonSchema` does not
  // reliably honor `exclusiveMinimum`.
  const massFields = {
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

/** Call-2 ingredient schema: gross mass + refuse share, edible derived server-side. */
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
