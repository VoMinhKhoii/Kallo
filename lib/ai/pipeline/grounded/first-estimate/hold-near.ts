/**
 * Holds a meal near the model's plain read of it. Rows priced part by part can
 * land far from any sensible meal: one wrong row ("Xôi" on a boiled rice row at
 * a third of its energy) moves the whole total. Past the band, the free parts
 * scale together to the band's edge, so every part, row and reason stays and
 * only the amounts move. Anything the user pinned, a typed weight or a weighed
 * dish, never moves.
 *
 * The meal is priced by the code that prices the result, so the check sees the
 * calories the user will see. A price is not quite linear in grams (the fat
 * guard clamps), so the fit is measured, and it ships only if it landed closer.
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
  const target = Math.min(
    estimateKcal * BAND,
    Math.max(estimateKcal / BAND, total)
  );
  if (!(total > 0) || target === total) return unchanged;

  // One trial scale shows how much of the meal can move.
  const trialK = target / total;
  const trial = price(
    { ...state, grounded: scaleFree(state, trialK) },
    mealText
  );
  const free = (trial - total) / (trialK - 1);
  const k = (target - (total - free)) / free;
  if (!(free > 0) || !(k > 0)) return unchanged;

  const grounded = scaleFree(state, k);
  const fitted = { ...state, grounded };
  const landed = price(fitted, mealText);
  if (Math.abs(landed - target) >= Math.abs(total - target)) return unchanged;
  console.info(
    `[first-estimate] meal ${Math.round(total)} kcal held at ${Math.round(landed)} (plain read ${Math.round(estimateKcal)})`
  );
  return { state: fitted, scaled: true };
}
