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
 * Cooked-to-raw weight conversion factors by cooking method.
 * Multiplied by cooked weight to get raw equivalent weight.
 * E.g., 150g cooked rice × 0.38 = 57g raw rice.
 *
 * Sources: FAO food yield factors for Vietnamese ingredients.
 * null cooking method → 1.0 (assumed raw/unprocessed)
 */
export const COOKED_TO_RAW_FACTOR: Record<string, number> = {
  nấu: 0.38, // rice/grains: cooked is ~2.6× heavier than raw (1/2.6 ≈ 0.38)
  luộc: 0.75, // boiled: slight water absorption (meat/eggs)
  chiên: 0.85, // fried: loses moisture
  xào: 0.85, // stir-fried: loses moisture
  kho: 0.8, // braised: loses some moisture, absorbs sauce
  nướng: 0.75, // grilled: loses moisture/fat
  hấp: 0.9, // steamed: minimal change
  rán: 0.85, // deep-fried: loses moisture
  rang: 0.85, // dry-roasted: loses moisture
  ninh: 0.75, // slow-simmered: loses moisture (similar to boiled)
};

/** Default cooked-to-raw factor when cooking method is unknown or null */
export const DEFAULT_COOKED_TO_RAW_FACTOR = 1.0;

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
