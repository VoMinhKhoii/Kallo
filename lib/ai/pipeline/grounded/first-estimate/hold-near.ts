/**
 * Holds a meal near the model's plain read of it. Rows priced part by part can
 * land far from any sensible meal: one wrong row ("Xôi" on a boiled rice row at
 * a third of its energy) moves the whole total. Past the band, the free parts
 * scale together to the band's edge, so every part, row and reason stays and
 * only the amounts move. Anything the user pinned, a typed weight or a weighed
 * dish, never moves.
 *
 * The meal is priced by the code that prices the result, so the check sees the
 * calories the user will see. That price is not linear in grams (the fat guard
 * clamps), so the scale is searched for against it, never worked out.
 */

import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { RunState } from '@/lib/ai/pipeline/grounded/run-state';
import { scaleEstimate } from '@/lib/ai/pipeline/resolve/estimate-scale';
import { reconcileNutritionIds } from '@/lib/ai/pipeline/resolve/macro-resolution';
import { portionAnchor } from '@/lib/ai/pipeline/resolve/refuse-mass';
import { bridgeV2ToV1 } from '@/lib/ai/pipeline/resolve/resolve';
import { pairIngredientsWithGrounded } from '@/lib/ai/pipeline/resolve/verdicts';

/** The meal may sit this many times above or below the plain read. */
const BAND = 1.2;
/** Free parts move by at most this factor either way; past it, trust them. */
const MAX_SCALE = 3;
/** Search steps: enough to land within about 1% of the scale. */
const STEPS = 8;

/** The meal's kcal as the result will show it. */
export function shippedKcal(state: RunState, mealText: string): number {
  const bridged = bridgeV2ToV1({
    v2: state.decomposition,
    matches: state.matchResults,
    grounded: state.grounded,
    mealContext: mealText,
    portionResolutions: state.portionResolutions,
  });
  const { mealItems } = reconcileNutritionIds(
    bridged.rawNutrition,
    bridged.decomposition,
    bridged.matched
  );
  return mealItems
    .flatMap((item) => item.ingredients)
    .reduce((kcal, part) => kcal + part.caloriesKcal.mid, 0);
}

/** `state` with its free parts scaled by `k`. */
function scaleFree(state: RunState, k: number): GroundedEstimation {
  const grounded = structuredClone(state.grounded);
  pairIngredientsWithGrounded(state.decomposition, grounded).forEach(
    ({ mealItemIdx, ground }, f) => {
      const portion = state.portionResolutions[f];
      const weighed =
        state.decomposition.mealItems[mealItemIdx]?.servedMassG != null;
      if (
        ground &&
        !weighed &&
        !portionAnchor(portion) &&
        portion?.provenance !== 'unresolved'
      )
        Object.assign(ground, scaleEstimate(ground, k));
    }
  );
  return grounded;
}

export function holdNearFirstEstimate(
  state: RunState,
  estimateKcal: number,
  mealText: string,
  price: typeof shippedKcal = shippedKcal
): { state: RunState; scaled: boolean } {
  const unchanged = { state, scaled: false };
  const total = price(state, mealText);
  const lowest = estimateKcal / BAND;
  const highest = estimateKcal * BAND;
  if (!(total > 0) || (total >= lowest && total <= highest)) return unchanged;

  const over = total > highest;
  const target = over ? highest : lowest;
  const priceAt = (k: number) =>
    price({ ...state, grounded: scaleFree(state, k) }, mealText);
  // What the user pinned alone passes the band: their numbers win, leave it.
  if (over && priceAt(1e-6) >= target) return unchanged;
  let small = over ? 1 / MAX_SCALE : 1;
  let large = over ? 1 : MAX_SCALE;
  for (let step = 0; step < STEPS; step++) {
    const middle = (small + large) / 2;
    if (priceAt(middle) > target) large = middle;
    else small = middle;
  }
  // The end of the search on the band's side of the target.
  const fitted = { ...state, grounded: scaleFree(state, over ? small : large) };
  const landed = price(fitted, mealText);
  const closer = Math.abs(landed - target) < Math.abs(total - target);
  const pastTheBand = over ? landed < lowest : landed > highest;
  if (!closer || pastTheBand) return unchanged;
  console.info(
    `[first-estimate] meal ${Math.round(total)} kcal held at ${Math.round(landed)} (plain read ${Math.round(estimateKcal)})`
  );
  return { state: fitted, scaled: true };
}
