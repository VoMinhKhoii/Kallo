/**
 * Scaling one Call 2 ingredient estimate as a whole: its mass, plate mass and
 * every macro bound move together, so the food keeps its density and range.
 */
import type { GroundedIngredientEstimate } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';

/** An estimate with its mass and macros multiplied by `k`. */
export function scaleEstimate(
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
    ...(e.servedG ? { servedG: e.servedG * k } : {}),
    proteinG: t(e.proteinG),
    carbohydrateG: t(e.carbohydrateG),
    fatG: t(e.fatG),
  };
}
