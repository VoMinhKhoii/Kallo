/**
 * D2 — simple-meal fast path.
 *
 * ORPHANED INTENTIONALLY: production no longer imports this module because
 * every meal must run Call 2 for cooking-fat judgment. Keep the synthesizer
 * and its tests until the other in-flight pipeline branch lands; remove them
 * only in a conflict-aware follow-up.
 *
 * When EVERY ingredient in a meal is "fully grounded" — an exact-match DB hit
 * (Phase 2, similarity 1.0, exactly one candidate) AND a server-resolved
 * portion anchor from the resolver ladder steps 1-4 (Phase 3, no LLM range) —
 * Call 2 has nothing to add: the food row is known and the grams are
 * server-resolved. Retrieval already happened BEFORE Call 2; this skips Call 2
 * only when it would merely re-derive numbers the server already holds.
 *
 * Correctness contract: the fast path MUST produce the SAME macros the full
 * path would. It does so by SYNTHESIZING the exact `GroundedEstimation` the LLM
 * would have emitted for the clean case (accept c1, use the anchor grams, echo
 * the DB-anchored fat) and feeding it through the UNCHANGED bridge → reconcile
 * → assemble. Nothing bypasses the normal downstream, so a fully-grounded meal
 * is numerically identical whether or not the fast path fires. Any ingredient
 * needing LLM judgment (unmatched, rejected, ambiguous, prep-note fat nuance,
 * or a resolver `llm_range`/`unresolved`) disqualifies the meal → full Call 2.
 */

import type { IngredientV2MatchResult } from '../matching/top-k-cascade';
import type { PortionResolution } from '../portion/types';
import { computeDbScalingGrams, scalePer100g } from './bounded-macros';
import type {
  GroundedEstimation,
  GroundedIngredientEstimate,
  GroundedMealItem,
  MealDecompositionV2,
} from './schemas-v2';

/**
 * A resolution is a grounded ANCHOR (ladder steps 1-4) iff it produced grams
 * with a non-deferred provenance. `llm_range` and `unresolved` are NOT anchors
 * — they explicitly hand portion judgment to Call 2 / clarify.
 */
function isGroundedAnchor(r: PortionResolution | undefined): boolean {
  return (
    r != null &&
    r.grams != null &&
    r.provenance !== 'llm_range' &&
    r.provenance !== 'unresolved' &&
    Number.isFinite(r.grams.mid) &&
    r.grams.mid > 0
  );
}

/**
 * A candidate is an exact-match hit iff similarity is exactly 1.0 — the
 * `EXACT_MATCH_SIMILARITY` sentinel `resolveExactMatch` assigns. The embedding
 * cascade never returns 1.0, so this cleanly distinguishes the two.
 */
function isExactMatchHit(match: IngredientV2MatchResult | undefined): boolean {
  if (
    match == null ||
    match.candidates.length !== 1 ||
    match.candidates[0].info.similarity !== 1
  ) {
    return false;
  }
  // The DB row must carry a COMPLETE core-macro set: the fast path scales
  // per-100g values with no LLM judgment, so a row with missing/non-finite
  // macros would synthesize confident zeros — exactly the silent-zero class.
  const n = match.candidates[0].nutrition;
  return (
    n != null &&
    [n.caloriesKcal, n.proteinG, n.carbohydrateG, n.fatG].every(
      (v) => v != null && Number.isFinite(v)
    )
  );
}

/**
 * Cooking methods that ADD fat the flat DB row does not carry (absorbed oil).
 * Estimating that adjustment is Call-2 judgment — never fast-path.
 */
const FAT_ADDING_METHOD =
  /chiên|rán|xào|áp chảo|fried|fry|stir[- ]?fr|sauté|saute|pan[- ]?sear/i;

/** True iff the ingredient carries at least one non-empty prepNote. */
function hasPrepNotes(notes: string[] | undefined): boolean {
  return (notes ?? []).some(
    (n) => typeof n === 'string' && n.trim().length > 0
  );
}

/**
 * Is this meal fully grounded (every ingredient exact-matched AND anchored,
 * with no prep-note fat nuance)? Conservative: ANY ingredient that fails a
 * check disqualifies the whole meal. `matchResults` and `portionResolutions`
 * are both in flat-ingredient order (same walk as the bridge).
 */
export function isFullyGrounded(args: {
  decomposition: MealDecompositionV2;
  matchResults: IngredientV2MatchResult[];
  portionResolutions: PortionResolution[];
}): boolean {
  const { decomposition, matchResults, portionResolutions } = args;
  let flatIdx = 0;
  for (const mi of decomposition.mealItems) {
    for (const ing of mi.ingredients) {
      const match = matchResults[flatIdx];
      const portion = portionResolutions[flatIdx];
      flatIdx++;
      if (!isExactMatchHit(match)) return false;
      if (!isGroundedAnchor(portion)) return false;
      // Prep notes shift fat/PC density → that's LLM judgment; not fast-path.
      if (hasPrepNotes(ing.prepNotes)) return false;
      // Oil-absorbing cooking methods need Call-2's absorbed-fat adjustment.
      if (FAT_ADDING_METHOD.test(ing.cookingMethod ?? '')) return false;
    }
  }
  // A zero-ingredient meal has nothing to ground — let the full path handle it.
  return flatIdx > 0;
}

/**
 * Synthesize the `GroundedEstimation` the LLM would have emitted for a fully-
 * grounded meal. For each ingredient:
 *   - selectedCandidateId = 'c1' (accept the exact-match candidate),
 *   - grams = the server anchor (resolver mid),
 *   - all four macro triples = the DB-anchored base (per_100g ×
 *     dbScalingGrams/100), computed with the SAME `computeDbScalingGrams` /
 *     `scalePer100g` the reconcile path uses. P/C/kcal are then OVERWRITTEN
 *     downstream from the same base, and fat passes `guardMacro` unchanged —
 *     so emitting them here is redundancy, not a second opinion. They exist
 *     because the schema now REQUIRES every triple (the D3 optionality that
 *     let an omitted field become a silent zero is reverted).
 *
 * The result is fed through the unchanged bridge, so downstream macros are
 * identical to the full path's for this clean case.
 *
 * PRECONDITION: `isFullyGrounded(...)` returned true for these inputs.
 */
export function buildFastPathEstimation(args: {
  decomposition: MealDecompositionV2;
  matchResults: IngredientV2MatchResult[];
  portionResolutions: PortionResolution[];
}): GroundedEstimation {
  const { decomposition, matchResults, portionResolutions } = args;
  let flatIdx = 0;
  const mealItems: GroundedMealItem[] = decomposition.mealItems.map((mi) => {
    const ingredients: GroundedIngredientEstimate[] = mi.ingredients.map(
      (ing) => {
        const match = matchResults[flatIdx];
        const portion = portionResolutions[flatIdx];
        flatIdx++;
        const candidate = match.candidates[0];
        // Anchor grams (guaranteed present + finite by isFullyGrounded).
        const grams = (portion.grams as { mid: number }).mid;

        // Base fat = DB per_100g × dbScalingGrams / 100, replicating the bridge:
        // raw/unknown candidates force weightBasis='raw' (skip cooked→raw);
        // cooked candidates use grams as-is.
        const dbState = candidate.info.state as 'raw' | 'cooked' | 'unknown';
        const weightBasis =
          dbState === 'raw' || dbState === 'unknown' ? 'raw' : undefined;
        const dbScalingGrams = computeDbScalingGrams({
          grams,
          dbState,
          cookingMethod: ing.cookingMethod ?? mi.cookingMethod ?? null,
          weightBasis,
        });
        const base = scalePer100g(
          candidate.nutrition as NonNullable<typeof candidate.nutrition>,
          dbScalingGrams
        );
        const flat = (value: number) => {
          const v = Math.max(0, value);
          return { low: v, mid: v, high: v };
        };

        return {
          ingredientName: ing.rawName,
          selectedCandidateId: 'c1',
          // The resolver anchor is edible mass; a synthetic refusePct of 0
          // keeps edibleG = grossG through the shared refuse math.
          grossG: grams,
          refusePct: 0,
          // Echo the DB-anchored base as flat triples. Fat: guardMacro passes
          // it through byte-identical to the reconcile path's
          // flatTriple(base.fatG). P/C/kcal: overwritten downstream from the
          // same base, present only because the schema requires every triple.
          caloriesKcal: flat(base.caloriesKcal),
          proteinG: flat(base.proteinG),
          carbohydrateG: flat(base.carbohydrateG),
          fatG: flat(base.fatG),
        };
      }
    );
    return { mealItemName: mi.name, ingredients };
  });
  return { mealItems };
}
