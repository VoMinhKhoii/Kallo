import type { Goal } from '@/lib/onboarding/types';
import type {
  BoundedEstimate,
  BoundedNutrition,
  GoalAdjustedNutrient,
  NutritionValues,
} from './types';
import {
  GOAL_ADJUSTED_NUTRIENTS,
  GOAL_BOUND_DIRECTION,
  NUTRITION_KEYS,
} from './types';

/**
 * Apply goal adjustment to a single bounded estimate for one nutrient.
 *
 * Formula: displayed = mid + aggression × (goal_bound − mid)
 * - goal_bound is 'high' or 'low' depending on goal + nutrient
 * - Non-goal-adjusted nutrients (micronutrients) always return mid
 * - Null input returns null
 */
export function goalAdjust(
  estimate: BoundedEstimate | null,
  goal: Goal,
  aggression: number,
  nutrientKey: keyof NutritionValues,
): number | null {
  if (estimate === null) return null;

  const isGoalAdjusted = (
    GOAL_ADJUSTED_NUTRIENTS as readonly string[]
  ).includes(nutrientKey);

  if (!isGoalAdjusted || aggression === 0) {
    return estimate.mid;
  }

  const direction =
    GOAL_BOUND_DIRECTION[goal][nutrientKey as GoalAdjustedNutrient];
  const goalBound = direction === 'high' ? estimate.high : estimate.low;

  return estimate.mid + aggression * (goalBound - estimate.mid);
}

/**
 * Apply goal adjustment to all nutrients in a BoundedNutrition,
 * producing a flat NutritionValues with single displayed values.
 */
export function goalAdjustNutrition(
  bounded: BoundedNutrition,
  goal: Goal,
  aggression: number,
): NutritionValues {
  const result = {} as Record<string, number | null>;

  for (const key of NUTRITION_KEYS) {
    result[key] = goalAdjust(bounded[key], goal, aggression, key);
  }

  return result as NutritionValues;
}

/**
 * Sum bounded nutrition across multiple items.
 * For each nutrient, sums low/mid/high independently.
 * If ALL items have null for a nutrient, the sum is null.
 */
export function sumBoundedNutrition(
  items: BoundedNutrition[],
): BoundedNutrition {
  const result = {} as Record<string, BoundedEstimate | null>;

  for (const key of NUTRITION_KEYS) {
    let low = 0;
    let mid = 0;
    let high = 0;
    let hasAny = false;

    for (const item of items) {
      const val = item[key];
      if (val !== null) {
        low += val.low;
        mid += val.mid;
        high += val.high;
        hasAny = true;
      }
    }

    result[key] = hasAny ? { low, mid, high } : null;
  }

  return result as BoundedNutrition;
}

/**
 * Sum displayed nutrition across multiple items.
 * For each nutrient, sums non-null values. If all null, result is null.
 */
export function sumDisplayedNutrition(
  items: NutritionValues[],
): NutritionValues {
  const result = {} as Record<string, number | null>;

  for (const key of NUTRITION_KEYS) {
    let sum = 0;
    let hasAny = false;

    for (const item of items) {
      const val = item[key];
      if (val !== null) {
        sum += val;
        hasAny = true;
      }
    }

    result[key] = hasAny ? sum : null;
  }

  return result as NutritionValues;
}
