/**
 * Holds a meal near the model's plain read of it. Rows priced part by part can
 * land far from any sensible meal: one wrong row ("Xôi" on a boiled rice row at
 * a third of its energy) moves the whole total. Past the band, the free parts
 * scale together to the band's edge, so every part, row and reason stays and
 * only the amounts move. Anything the user pinned, a typed weight or a weighed
 * dish, never moves.
 */

import type { GroundedIngredientEstimate } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { RunState } from '@/lib/ai/pipeline/grounded/run-state';
import { scaleEstimate } from '@/lib/ai/pipeline/resolve/estimate-scale';
import {
  portionAnchor,
  selectedCandidate,
  shippedEdibleGrams,
} from '@/lib/ai/pipeline/resolve/refuse-mass';
import { pairIngredientsWithGrounded } from '@/lib/ai/pipeline/resolve/verdicts';

/** The meal may sit this many times above or below the plain read. */
const BAND = 1.2;

const macroKcal = (estimate: GroundedIngredientEstimate): number =>
  4 * estimate.proteinG.mid +
  4 * estimate.carbohydrateG.mid +
  9 * estimate.fatG.mid;

export function holdNearFirstEstimate(
  state: RunState,
  estimateKcal: number
): { state: RunState; scaled: boolean } {
  const grounded = structuredClone(state.grounded);
  let pinned = 0;
  let free = 0;
  const freeParts: GroundedIngredientEstimate[] = [];
  pairIngredientsWithGrounded(state.decomposition, grounded).forEach(
    ({ mealItemIdx, ground }, f) => {
      const portion = state.portionResolutions[f];
      if (!ground || portion?.provenance === 'unresolved') return;
      const match = state.matchResults[f];
      const rowKcal = selectedCandidate(ground, match)?.nutrition?.caloriesKcal;
      const kcal =
        rowKcal != null
          ? (shippedEdibleGrams(ground, match, portion) * rowKcal) / 100
          : macroKcal(ground);
      const weighed =
        state.decomposition.mealItems[mealItemIdx]?.servedMassG != null;
      if (portionAnchor(portion) || weighed) pinned += kcal;
      else {
        free += kcal;
        freeParts.push(ground);
      }
    }
  );

  const total = pinned + free;
  const target = Math.min(
    estimateKcal * BAND,
    Math.max(estimateKcal / BAND, total)
  );
  const k = (target - pinned) / free;
  if (!(free > 0) || target === total || !(k > 0))
    return { state, scaled: false };
  for (const ground of freeParts)
    Object.assign(ground, scaleEstimate(ground, k));
  console.info(
    `[first-estimate] meal ${Math.round(total)} kcal held at ${Math.round(target)} (plain read ${Math.round(estimateKcal)})`
  );
  return { state: { ...state, grounded }, scaled: true };
}
