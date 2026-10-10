/**
 * Splice rescued parts into the main run: each rescued ingredient is replaced,
 * in place, by the single foods its mini-meal split it into. The parts carry
 * the mini-meal's rows and row choices, but their grams are scaled so the mass
 * the bridge ships for them adds up to what it would have shipped for the
 * ingredient, since the main run saw the whole meal and the user's quantity.
 */
import type { IngredientV2MatchResult } from '@/lib/ai/matching/candidate';
import type {
  DecomposedIngredientV2,
  MealDecompositionV2,
} from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type {
  GroundedEstimation,
  GroundedIngredientEstimate,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import { resolveGroundedMass } from '@/lib/ai/pipeline/resolve/refuse-mass';
import { pairIngredientsWithGrounded } from '@/lib/ai/pipeline/resolve/verdicts';
import type { PortionResolution } from '@/lib/ai/portion/types';

/** One single food from a rescue mini-meal, with its row candidates and estimate. */
export interface RescuePart {
  ingredient: DecomposedIngredientV2;
  match: IngredientV2MatchResult;
  estimate: GroundedIngredientEstimate;
}

export interface RunState {
  decomposition: MealDecompositionV2;
  matchResults: IngredientV2MatchResult[];
  portionResolutions: PortionResolution[];
  grounded: GroundedEstimation;
}

/** A rescued part has no portion anchor: its scaled Call 2 grams stand. */
const DEFER_TO_CALL_TWO: PortionResolution = {
  grams: null,
  massBasis: null,
  provenance: 'llm_range',
  confidence: 'none',
  note: 'rescue part: grams scaled to the main run',
};

/**
 * The edible grams the bridge ships for one ingredient, by the bridge's own
 * rules (`resolveGroundedMass`: refuse bands, served-form overrides, a server
 * portion anchor when there is one). Linear in `grossG` when unanchored, which
 * is what lets scaling the parts' gross mass hit a target exactly.
 */
function shippedEdibleGrams(
  estimate: GroundedIngredientEstimate,
  ingredient: DecomposedIngredientV2,
  match: IngredientV2MatchResult | undefined,
  portion: PortionResolution | undefined
): number {
  const idx = /^c(\d+)$/.exec(estimate.selectedCandidateId ?? '')?.[1];
  const candidate = idx ? match?.candidates[Number(idx) - 1] : undefined;
  const anchor =
    portion?.grams &&
    portion.provenance !== 'llm_range' &&
    portion.provenance !== 'unresolved' &&
    portion.grams.mid > 0
      ? { grams: portion.grams.mid, basis: portion.massBasis ?? 'unknown' }
      : null;
  return (
    resolveGroundedMass({
      ground: estimate,
      candidateInediblePct: candidate?.inediblePct ?? null,
      canonicalName: ingredient.canonicalName,
      rawName: ingredient.rawName,
      prepNotes: ingredient.prepNotes,
      authoritativeMass: anchor,
    }).edibleG ?? 0
  );
}

function scaled(
  e: GroundedIngredientEstimate,
  k: number
): GroundedIngredientEstimate {
  const t = (b: GroundedIngredientEstimate['fatG']) => ({
    low: b.low * k,
    mid: b.mid * k,
    high: b.high * k,
  });
  return {
    ...e,
    grossG: e.grossG * k,
    proteinG: t(e.proteinG),
    carbohydrateG: t(e.carbohydrateG),
    fatG: t(e.fatG),
  };
}

/**
 * Replace each rescued flat ingredient (`parts` key = flat index in the main
 * decomposition) by its parts. Skipped, and left as it was: an ingredient the
 * portion resolver withheld or wants clarified (`unresolved`, which includes a
 * typed zero), and one whose estimate or parts carry no mass. A dish that got
 * parts has its Call 2 estimates rewritten in decomposition order, so the
 * resolver's name-based pairing cannot cross a part with a same-named
 * ingredient. Returns new state; the input is not mutated.
 */
export function spliceRescue(
  state: RunState,
  parts: Map<number, RescuePart[]>
): { state: RunState; rescued: number } {
  const grounded = structuredClone(state.grounded);
  const pairs = pairIngredientsWithGrounded(state.decomposition, grounded);
  const matchResults: IngredientV2MatchResult[] = [];
  const portionResolutions: PortionResolution[] = [];
  let rescued = 0;
  let flat = 0;

  const mealItems = state.decomposition.mealItems.map((mi) => {
    const ingredients: DecomposedIngredientV2[] = [];
    const ordered: GroundedIngredientEstimate[] = [];
    const own: GroundedIngredientEstimate[] = [];
    let touched = false;
    for (const ing of mi.ingredients) {
      const f = flat++;
      const ground = pairs[f]?.ground ?? null;
      if (ground) own.push(ground);
      const subParts = parts.get(f);
      const portion = state.portionResolutions[f];
      const target =
        ground && portion?.provenance !== 'unresolved'
          ? shippedEdibleGrams(ground, ing, state.matchResults[f], portion)
          : 0;
      const partsMass = (subParts ?? []).reduce(
        (sum, p) =>
          sum +
          shippedEdibleGrams(p.estimate, p.ingredient, p.match, undefined),
        0
      );
      if (!subParts?.length || target <= 0 || partsMass <= 0) {
        ingredients.push(ing);
        matchResults.push(state.matchResults[f]);
        portionResolutions.push(portion);
        if (ground) ordered.push(ground);
        continue;
      }
      const k = target / partsMass;
      for (const p of subParts) {
        ingredients.push(p.ingredient);
        matchResults.push(p.match);
        portionResolutions.push(DEFER_TO_CALL_TWO);
        ordered.push(scaled(p.estimate, k));
      }
      touched = true;
      rescued++;
    }
    if (touched) rewriteDishEstimates(grounded, own, ordered);
    return { ...mi, ingredients };
  });

  return {
    state: {
      decomposition: { ...state.decomposition, mealItems },
      matchResults: matchResults.map((m, i) => ({ ...m, ingredientIndex: i })),
      portionResolutions,
      grounded,
    },
    rescued,
  };
}

/**
 * Put a dish's estimates in decomposition order: the first Call 2 item that
 * held one of them gets them all (a dish Call 2 split pools by name anyway),
 * and the dish's estimates leave every other item. Estimates the pairing
 * never used stay where they were.
 */
function rewriteDishEstimates(
  grounded: GroundedEstimation,
  own: GroundedIngredientEstimate[],
  ordered: GroundedIngredientEstimate[]
): void {
  const mine = new Set(own);
  const holders = grounded.mealItems.filter((m) =>
    m.ingredients.some((g) => mine.has(g))
  );
  if (holders.length === 0) return;
  for (const item of holders)
    item.ingredients = item.ingredients.filter((g) => !mine.has(g));
  holders[0].ingredients.unshift(...ordered);
}
