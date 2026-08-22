// Nutrition value containers — the vocabulary every pipeline stage speaks in.

/** Bounded estimate stored as JSONB {low, mid, high} in meals/meal_items */
export interface BoundedEstimate {
  low: number;
  mid: number;
  high: number;
}

/**
 * Flat nutrition values — all 28 nutrients tracked by the system.
 * Used for: per-100g DB values, displayed (goal-adjusted) values.
 * Fields are nullable because not all foods have data for all nutrients.
 */
export interface NutritionValues {
  caloriesKcal: number | null;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
  calciumMg: number | null;
  ironMg: number | null;
  magnesiumMg: number | null;
  phosphorusMg: number | null;
  potassiumMg: number | null;
  zincMg: number | null;
  copperMcg: number | null;
  manganeseMg: number | null;
  betaCaroteneMcg: number | null;
  vitaminAMcg: number | null;
  vitaminDMcg: number | null;
  vitaminEMg: number | null;
  vitaminKMcg: number | null;
  vitaminCMg: number | null;
  vitaminB1Mg: number | null;
  vitaminB2Mg: number | null;
  vitaminPpMg: number | null;
  vitaminB5Mg: number | null;
  vitaminB6Mg: number | null;
  vitaminB9Mcg: number | null;
  vitaminB12Mcg: number | null;
  vitaminHMcg: number | null;
}

/** Bounded nutrition — each nutrient has low/mid/high or null */
export type BoundedNutrition = {
  [K in keyof NutritionValues]: BoundedEstimate | null;
};

/** The 4 macros that get goal-adjusted (shown to users) */
export type GoalAdjustedNutrient =
  | 'caloriesKcal'
  | 'proteinG'
  | 'carbohydrateG'
  | 'fatG';

/** All NutritionValues keys — useful for iteration. Lives with the type it enumerates. */
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
