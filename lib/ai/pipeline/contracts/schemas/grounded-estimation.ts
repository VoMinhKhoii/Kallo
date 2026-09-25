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
 *
 * LEAN OUTPUT. The server DERIVES kcal (4P + 4C + 9F) for every ingredient and
 * anchors P/C to the DB row for accepted matches (`resolveIngredientMacros`),
 * so the model never emits kcal and sends P/C as `null` on an accepted match.
 * Without an accepted candidate P/C are the only source — the D3 optionality
 * was reverted after prod meal "mì gói sứa" persisted an UNMATCHED noodle at
 * C:0g when the model omitted carbohydrateG. That guarantee now lives in three
 * places, none of which zero-fills:
 *   1. the keys stay REQUIRED (nullable, never optional) — measured
 *      2026-09-26 on Vertex, optional keys let the model skip P/C on unmatched
 *      rows 39× in 182 cases; a required key forces an explicit decision;
 *   2. `findUnanchoredNullMacros` + the estimator re-ask once with
 *      `groundedEstimationStrictSchema`, whose decoder cannot emit null — a
 *      blind retry of the same prompt repeated the null (4 meals failed all
 *      three attempts in the same run);
 *   3. `resolveMacroSource` carves out any row still without a source.
 */
function buildIngredientSchema(pc: 'nullable' | 'strict') {
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
  const pcTriple = (label: string) =>
    pc === 'strict'
      ? boundedEstimateSchema.describe(
          `${label} in grams for the edible portion. ALWAYS a triple; 0 is a valid value.`
        )
      : boundedEstimateSchema
          .nullable()
          .describe(
            `${label} in grams for the edible portion. A triple when selectedCandidateId is omitted or "none", or when prep_notes is non-empty; otherwise null (the server uses the DB row).`
          );

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
      proteinG: pcTriple('Protein'),
      carbohydrateG: pcTriple('Carbohydrates'),
      fatG: boundedEstimateSchema.describe(
        'Fat in grams for the as-eaten portion. ALWAYS emit — always LLM-driven (cooking-method effect); subject to hallucination guard.'
      ),
    })
    .strict();
}

/** The default (lean) Call-2 ingredient schema — P/C nullable. */
export function buildGroundedIngredientEstimateSchema() {
  return buildIngredientSchema('nullable');
}

/** Call-2 ingredient schema: gross mass + refuse share, edible derived server-side. */
export const groundedIngredientEstimateSchema =
  buildGroundedIngredientEstimateSchema();

function buildEstimationSchema(pc: 'nullable' | 'strict') {
  const mealItem = z
    .object({
      mealItemName: z
        .string()
        .describe('Must match the meal item name from decomposition.'),
      ingredients: z.array(buildIngredientSchema(pc)).min(1),
    })
    .strict();
  return {
    mealItem,
    estimation: z.object({ mealItems: z.array(mealItem).min(1) }),
  };
}

const lean = buildEstimationSchema('nullable');
export const groundedMealItemSchema = lean.mealItem;
export const groundedEstimationSchema = lean.estimation;

/**
 * The re-ask schema: P/C are required triples, so the provider's decoder
 * cannot emit null. Its output is a valid `GroundedEstimation`.
 */
export const groundedEstimationStrictSchema =
  buildEstimationSchema('strict').estimation;

export type GroundedIngredientEstimate = z.infer<
  typeof groundedIngredientEstimateSchema
>;
export type GroundedMealItem = z.infer<typeof groundedMealItemSchema>;
export type GroundedEstimation = z.infer<typeof groundedEstimationSchema>;

/** True when the model accepted a DB candidate for this ingredient. */
export function hasAcceptedCandidate(
  ing: Pick<GroundedIngredientEstimate, 'selectedCandidateId'>
): boolean {
  return ing.selectedCandidateId != null && ing.selectedCandidateId !== 'none';
}

/**
 * Ingredients with no accepted candidate whose P/C came back null — the rows
 * whose macros would otherwise have no source (the mì-gói shape).
 */
export function findUnanchoredNullMacros(
  estimation: GroundedEstimation
): Array<{ mealItemName: string; ingredientName: string }> {
  return estimation.mealItems.flatMap((item) =>
    item.ingredients
      .filter(
        (ing) =>
          !hasAcceptedCandidate(ing) &&
          (ing.proteinG == null || ing.carbohydrateG == null)
      )
      .map((ing) => ({
        mealItemName: item.mealItemName,
        ingredientName: ing.ingredientName,
      }))
  );
}
