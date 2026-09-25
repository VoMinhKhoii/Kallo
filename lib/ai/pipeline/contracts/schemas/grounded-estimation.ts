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
/**
 * P/C are the only macro source when no candidate was accepted, so they must
 * be present there — see the lean-output note on the schema fields.
 */
function requireMacrosWithoutDbAnchor(
  ing: {
    selectedCandidateId?: string;
    proteinG?: unknown;
    carbohydrateG?: unknown;
  },
  ctx: z.RefinementCtx
): void {
  const hasDbAnchor =
    ing.selectedCandidateId != null && ing.selectedCandidateId !== 'none';
  if (hasDbAnchor) return;
  for (const key of ['proteinG', 'carbohydrateG'] as const) {
    if (ing[key] == null) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `${key} is required when no candidate is accepted`,
      });
    }
  }
}

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
      // Lean output: the server DERIVES kcal (4P + 4C + 9F) for every
      // ingredient and anchors P/C to the DB row for accepted matches
      // (`resolveIngredientMacros`), so asking the model for them only bought
      // discarded tokens. P/C stay REQUIRED wherever they are the only source —
      // the D3 optionality was reverted after prod meal "mì gói sứa" persisted
      // an UNMATCHED noodle at C:0g when the model omitted carbohydrateG. The
      // `superRefine` below restores that guarantee per ingredient: no accepted
      // candidate (omitted or "none") → both triples required, and a miss
      // throws a ZodError into the zero-delay parse-retry path. An accepted
      // candidate whose DB nutrition never loaded is caught server-side
      // (`resolveMacroSource` → no_estimate carve-out), never zero-filled.
      proteinG: boundedEstimateSchema
        .optional()
        .describe(
          'Protein in grams for the edible portion. REQUIRED when selectedCandidateId is omitted or "none", or when prep_notes is non-empty; otherwise omit (the server uses the DB row).'
        ),
      carbohydrateG: boundedEstimateSchema
        .optional()
        .describe(
          'Carbohydrates in grams for the edible portion. REQUIRED when selectedCandidateId is omitted or "none", or when prep_notes is non-empty; otherwise omit (the server uses the DB row).'
        ),
      fatG: boundedEstimateSchema.describe(
        'Fat in grams for the as-eaten portion. ALWAYS emit — always LLM-driven (cooking-method effect); subject to hallucination guard.'
      ),
    })
    .strict()
    .superRefine(requireMacrosWithoutDbAnchor);
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
