import type { GoalAdjustedNutrient } from '@/lib/ai/types/nutrition-values';
import type { Goal } from '@/lib/domain/onboarding/types';

/**
 * The 4 macros that the LLM produces bounded estimates for AND that get goal-adjusted.
 * Both concerns share the same set — if they ever diverge, split into two arrays.
 */
export const GOAL_ADJUSTED_NUTRIENTS = [
  'caloriesKcal',
  'proteinG',
  'carbohydrateG',
  'fatG',
] as const;

/**
 * For each goal, which bound direction is the "goal bound" per nutrient.
 * Cutting = pessimistic: overestimate cal/carbs/fat, underestimate protein.
 * Bulking = optimistic: underestimate cal/carbs/fat, overestimate protein.
 * Maintaining = unused (aggression=0 → mid), but defined for type completeness.
 */
export const GOAL_BOUND_DIRECTION: Record<
  Goal,
  Record<GoalAdjustedNutrient, 'high' | 'low'>
> = {
  cutting: {
    caloriesKcal: 'high',
    proteinG: 'low',
    carbohydrateG: 'high',
    fatG: 'high',
  },
  bulking: {
    caloriesKcal: 'low',
    proteinG: 'high',
    carbohydrateG: 'low',
    fatG: 'low',
  },
  maintaining: {
    caloriesKcal: 'high',
    proteinG: 'low',
    carbohydrateG: 'high',
    fatG: 'high',
  },
};
