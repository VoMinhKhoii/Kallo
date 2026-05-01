import type { PipelineResponse } from '../types';

export interface ShadowDivergence {
  /** |candidateCal - primaryCal| / primaryCal (mid values). */
  macroDeltaPct: number;
  /** candidateIngredientCount - primaryIngredientCount. */
  ingredientCountDelta: number;
  /** Reserved for anomaly-type set diff once anomalies are on PipelineResponse. */
  anomalyTypeDelta: string[];
  /** Set when primary returned `{ success: false }`. */
  primaryFailed: boolean;
  /** Set when candidate returned `{ success: false }` but did not throw. */
  candidateFailed: boolean;
}

function totalCalMid(r: PipelineResponse): number | null {
  return r.success ? (r.data.boundedNutrition.caloriesKcal?.mid ?? null) : null;
}

function ingredientCount(r: PipelineResponse): number {
  return r.success
    ? r.data.mealItems.reduce((n, m) => n + m.ingredients.length, 0)
    : 0;
}

export function computeDivergence(
  primary: PipelineResponse,
  candidate: PipelineResponse | null
): ShadowDivergence {
  const primaryFailed = !primary.success;
  const candidateFailed = candidate !== null && !candidate.success;

  if (candidate === null) {
    return {
      macroDeltaPct: 0,
      ingredientCountDelta: 0,
      anomalyTypeDelta: [],
      primaryFailed,
      candidateFailed: false,
    };
  }

  const pCal = totalCalMid(primary);
  const cCal = totalCalMid(candidate);
  const macroDeltaPct =
    pCal !== null && cCal !== null && pCal > 0
      ? Math.abs(cCal - pCal) / pCal
      : 0;

  return {
    macroDeltaPct,
    ingredientCountDelta: ingredientCount(candidate) - ingredientCount(primary),
    anomalyTypeDelta: [],
    primaryFailed,
    candidateFailed,
  };
}
