/**
 * Per-ingredient plausibility classification for the v2 grounded pipeline.
 *
 * Phase 1 replaced the silent-zero mechanism (grams=1, kcal=0 rows) with an
 * explicit classification. This is now a TELEMETRY signal only — there is no
 * clarify round-trip. An `unresolved_estimate` ingredient still ships on its
 * best estimate and the user corrects the portion in the UI; only the bridge's
 * no-data carve-out (no portion / no macro anchor) withholds a row.
 *
 * The four classes:
 *   - 'ok'                       — resolved with a sensible portion + nutrition.
 *   - 'genuinely_noncaloric'     — water, black coffee, plain tea. Near-zero
 *                                  kcal is CORRECT here and must NOT be flagged.
 *   - 'small_concentrated_portion' — spices/oils/sweeteners/sauces that are
 *                                  legitimately ≤5g. Small grams is expected.
 *   - 'unresolved_estimate'      — the portion or nutrition could not be
 *                                  resolved (missing grams, no match + no
 *                                  macros). Flagged for telemetry, not blocked.
 *
 * Deliberately NOT a blanket `grams <= 5` rule: a 3g pinch of salt and a 3g
 * "chicken breast" are both small, but only the first is plausible. We lean on
 * the matched food's per-100g calorie density plus the name classes in
 * `food-classes.ts` to tell them apart.
 */

import {
  isCarbStapleName,
  isConcentratedName,
  isNoncaloricName,
} from './food-classes';

export type IngredientPlausibility =
  | 'ok'
  | 'genuinely_noncaloric'
  | 'small_concentrated_portion'
  | 'unresolved_estimate';

export interface PlausibilityInput {
  /** Resolved as-eaten grams. `null`/non-finite/≤0 means the portion never resolved. */
  grams: number | null;
  /** Whether Call 2 emitted a usable macro estimate for this ingredient. */
  hasNutrition: boolean;
  /** Matched DB row's per-100g energy, when the ingredient matched a candidate. */
  caloriesPer100g: number | null;
  /**
   * Carbohydrate density in g/100g when derivable, else null.
   * Matched: DB row per-100g carbs. Unmatched: Call 2 absolute carb mid
   * scaled by grams ((mid / grams) * 100). `undefined` (field not provided)
   * skips the carb-staple check entirely — backward-compatible with callers
   * that predate it.
   */
  carbsPer100g?: number | null;
  /** Ingredient name (rawName or canonicalName) for name-class heuristics. */
  name: string;
}

/**
 * Carb-density floor for staples, on the MID bound. Density is portion-
 * invariant, so this is robust across grams. 5 g/100g leaves headroom under
 * thin cháo (~8-13 g/100g — cháo is deliberately NOT in the staple list)
 * while catching C≈0 emissions outright; named low-carb substitutes
 * (konjac/shirataki) are exempted by name, not by threshold.
 */
export const STAPLE_MIN_CARBS_PER_100G = 5;

const SMALL_PORTION_MAX_GRAMS = 5;
/**
 * A resolved portion is "near-zero calories" when its total energy is below
 * this floor. Water/tea/black coffee land here even at 300g because their
 * per-100g density is ~0.
 */
const NEAR_ZERO_KCAL = 1;

function hasResolvedGrams(grams: number | null): grams is number {
  return grams != null && Number.isFinite(grams) && grams > 0;
}

/**
 * Classify a single ingredient result. Pure and side-effect-free so it can be
 * unit-tested in isolation and reused by the completeness gates.
 */
export function classifyIngredientPlausibility(
  input: PlausibilityInput
): IngredientPlausibility {
  const { grams, hasNutrition, caloriesPer100g, name } = input;

  // No portion OR no nutrition → the estimate never resolved. This is the
  // state the silent-zero mechanism used to paper over with grams=1/kcal=0.
  if (!hasResolvedGrams(grams) || !hasNutrition) {
    return 'unresolved_estimate';
  }

  // Genuinely non-caloric drinks: correct at any volume when the matched row
  // is near-zero density, or the name is unambiguously water/plain tea/black
  // coffee. Do NOT flag these. This check precedes the D3-missing-macro guard
  // so a water/coffee/tea name with omitted macros is still non-caloric, not
  // spuriously unresolved.
  const totalKcal =
    caloriesPer100g != null ? (caloriesPer100g * grams) / 100 : null;
  const densityIsNearZero =
    caloriesPer100g != null && caloriesPer100g < NEAR_ZERO_KCAL;
  // A caloric modifier disqualifies the name-based match, but NOT the measured
  // one: a DB row at <1 kcal/100g is evidence, not a heuristic.
  if (
    isNoncaloricName(name) ||
    (totalKcal != null && densityIsNearZero && totalKcal < NEAR_ZERO_KCAL)
  ) {
    return 'genuinely_noncaloric';
  }

  // Carb-staple floor (bánh-ướt-chả-bò bug class): a rice/noodle/bread base
  // must carry real carbs. `undefined` skips the check (backward-compat). When
  // provided, MATCHED carbs come from the DB row and UNMATCHED carbs are the
  // scaled Call 2 mid; either way a density below the floor is implausible for
  // a staple → flag it. Non-null-vs-null semantics: a known low
  // density trips outright; a null density (carb triple omitted for an
  // unmatched staple) only trips when calories are ALSO absent, so a matched
  // staple with a null DB carb but a real energy density still passes.
  if (input.carbsPer100g !== undefined && isCarbStapleName(name)) {
    const carbs = input.carbsPer100g;
    if (carbs != null && carbs < STAPLE_MIN_CARBS_PER_100G) {
      return 'unresolved_estimate';
    }
    if (carbs == null && caloriesPer100g == null) {
      return 'unresolved_estimate';
    }
  }

  // Small concentrated portions (spices/oils/sweeteners/sauces): a small gram
  // count is legitimate ONLY when the name is in the concentrated class. A 3g
  // "chicken breast" does NOT get a pass here — it falls through to 'ok' and
  // the anomaly detector / caller can still flag an implausible portion.
  if (grams <= SMALL_PORTION_MAX_GRAMS && isConcentratedName(name)) {
    return 'small_concentrated_portion';
  }

  return 'ok';
}
