/**
 * Splice rescued parts into the main run: each rescued ingredient is replaced,
 * in place, by the single foods its mini-meal split it into. The parts carry
 * the mini-meal's rows and row choices, but their grams are scaled so they
 * add up to the mass the main run would have shipped for the dish, which saw
 * the whole meal and the user's quantity.
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

const edibleGrams = (e: GroundedIngredientEstimate): number =>
  e.grossG * (1 - (e.refusePct ?? 0) / 100);

/**
 * The edible mass the main run would ship for an ingredient: a server portion
 * anchor when it had one (the bridge prefers it), else Call 2's grams.
 */
function shippedEdibleGrams(
  estimate: GroundedIngredientEstimate,
  portion: PortionResolution | undefined
): number {
  const anchored =
    portion?.grams != null &&
    portion.provenance !== 'llm_range' &&
    portion.provenance !== 'unresolved' &&
    portion.grams.mid > 0;
  if (!anchored || !portion?.grams) return edibleGrams(estimate);
  return portion.massBasis === 'gross_as_served'
    ? portion.grams.mid * (1 - (estimate.refusePct ?? 0) / 100)
    : portion.grams.mid;
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
 * decomposition) by its parts. An ingredient whose estimate or parts carry no
 * mass is left as it was. Returns new state; the input is not mutated.
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
    for (const ing of mi.ingredients) {
      const f = flat++;
      const subParts = parts.get(f);
      const ground = pairs[f]?.ground;
      const target = ground
        ? shippedEdibleGrams(ground, state.portionResolutions[f])
        : 0;
      const partsMass = (subParts ?? []).reduce(
        (sum, p) => sum + edibleGrams(p.estimate),
        0
      );
      const item = ground
        ? grounded.mealItems.find((m) => m.ingredients.includes(ground))
        : undefined;
      if (
        !subParts?.length ||
        !ground ||
        !item ||
        target <= 0 ||
        partsMass <= 0
      ) {
        ingredients.push(ing);
        matchResults.push(state.matchResults[f]);
        portionResolutions.push(state.portionResolutions[f]);
        continue;
      }
      const k = target / partsMass;
      item.ingredients.splice(
        item.ingredients.indexOf(ground),
        1,
        ...subParts.map((p) => scaled(p.estimate, k))
      );
      for (const p of subParts) {
        ingredients.push(p.ingredient);
        matchResults.push(p.match);
        portionResolutions.push(DEFER_TO_CALL_TWO);
      }
      rescued++;
    }
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
