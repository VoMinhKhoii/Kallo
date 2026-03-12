import type { Goal } from '@/lib/onboarding/types';
import type { GoalAdjustedNutrient, NutritionValues } from './types';

/** All NutritionValues keys — useful for iteration */
export const NUTRITION_KEYS: readonly (keyof NutritionValues)[] = [
  'caloriesKcal',
  'proteinG',
  'carbohydrateG',
  'fatG',
  'fiberG',
  'sodiumMg',
  'calciumMg',
  'ironMg',
  'magnesiumMg',
  'phosphorusMg',
  'potassiumMg',
  'zincMg',
  'copperMcg',
  'manganeseMg',
  'betaCaroteneMcg',
  'vitaminAMcg',
  'vitaminDMcg',
  'vitaminEMg',
  'vitaminKMcg',
  'vitaminCMg',
  'vitaminB1Mg',
  'vitaminB2Mg',
  'vitaminPpMg',
  'vitaminB5Mg',
  'vitaminB6Mg',
  'vitaminB9Mcg',
  'vitaminB12Mcg',
  'vitaminHMcg',
] as const;

/** The 4 macros that get goal-adjusted (shown to users) */
export const GOAL_ADJUSTED_NUTRIENTS = [
  'caloriesKcal',
  'proteinG',
  'carbohydrateG',
  'fatG',
] as const;

/**
 * The 5 nutrients that LLM Call 2 produces bounded estimates for.
 * All remaining nutrients pass through as DB mid values.
 */
export const LLM_BOUNDED_NUTRIENTS = [
  'caloriesKcal',
  'proteinG',
  'carbohydrateG',
  'fatG',
  'fiberG',
] as const;

export type LlmBoundedNutrient = (typeof LLM_BOUNDED_NUTRIENTS)[number];

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
