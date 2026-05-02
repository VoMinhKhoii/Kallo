import type { Goal, ProteinPortion, RicePortion } from '@/lib/onboarding/types';
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
 * Cooked-to-raw weight conversion factors by cooking method.
 * Multiplied by cooked weight to get raw equivalent weight.
 * E.g., 150g cooked rice × 0.38 = 57g raw rice.
 *
 * Sources: FAO food yield factors for Vietnamese ingredients.
 * null cooking method → 1.0 (assumed raw/unprocessed)
 */
export const COOKED_TO_RAW_FACTOR: Record<string, number> = {
  // Vietnamese cooking methods
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
  // English cooking method aliases
  boil: 0.75,
  boiled: 0.75,
  simmer: 0.75,
  simmered: 0.75,
  'slow-simmer': 0.75,
  'slow-simmered': 0.75,
  braise: 0.8,
  braised: 0.8,
  fry: 0.85,
  fried: 0.85,
  'pan-fry': 0.85,
  'pan-fried': 0.85,
  'deep-fry': 0.85,
  'deep-fried': 0.85,
  'stir-fry': 0.85,
  'stir-fried': 0.85,
  grill: 0.75,
  grilled: 0.75,
  roast: 0.75,
  roasted: 0.75,
  bake: 0.75,
  baked: 0.75,
  steam: 0.9,
  steamed: 0.9,
  'dry-roast': 0.85,
  'dry-roasted': 0.85,
};

/** Default cooked-to-raw factor when cooking method is unknown or null */
export const DEFAULT_COOKED_TO_RAW_FACTOR = 1.0;

/** Convert cooked/as-eaten weight to raw equivalent using cooking method factor */
export function convertCookedToRaw(
  cookedGrams: number,
  cookingMethod: string | null
): number {
  const factor = cookingMethod
    ? (COOKED_TO_RAW_FACTOR[cookingMethod] ?? DEFAULT_COOKED_TO_RAW_FACTOR)
    : DEFAULT_COOKED_TO_RAW_FACTOR;
  return Math.round(cookedGrams * factor);
}

/** User-facing portion descriptions used in LLM prompts */
export const RICE_PORTION_DESCRIPTION: Record<RicePortion, string> = {
  small: '~1 small bowl (~100g cooked rice)',
  medium: '~1–1.5 bowls (~150g cooked rice)',
  large: '~2+ bowls (~250g cooked rice)',
};

export const PROTEIN_PORTION_DESCRIPTION: Record<ProteinPortion, string> = {
  small: 'smaller than palm, ~2-3 eggs (~80g cooked)',
  medium: 'about palm-sized (~120g cooked)',
  large: 'bigger than palm, e.g. a chicken thigh (~160g cooked)',
};

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
