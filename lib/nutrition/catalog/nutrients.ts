import type { NutrientMeta, NutritionNutrientKey } from '../types';

export const DEFAULT_NUTRIENTS = [
  'calciumMg',
  'ironMg',
  'vitaminCMg',
  'phosphorusMg',
  'vitaminB1Mg',
  'vitaminB2Mg',
  'vitaminPpMg',
  'vitaminAMcg',
] as const satisfies readonly NutritionNutrientKey[];

export const MORE_NUTRIENTS = [
  'sodiumMg',
  'magnesiumMg',
  'potassiumMg',
  'zincMg',
  'copperMcg',
  'manganeseMg',
  'vitaminB12Mcg',
  'vitaminB9Mcg',
  'vitaminB5Mg',
  'vitaminB6Mg',
  'vitaminEMg',
  'vitaminKMcg',
] as const satisfies readonly NutritionNutrientKey[];

export const HIDDEN_NUTRIENTS = [
  'vitaminHMcg',
] as const satisfies readonly NutritionNutrientKey[];

export const EDUCATION_NUTRIENTS = [
  'vitaminDMcg',
] as const satisfies readonly NutritionNutrientKey[];

export const SUPPORTED_CANDIDATE_NUTRIENTS = [
  'calciumMg',
  'ironMg',
  'vitaminCMg',
  'phosphorusMg',
  'vitaminB1Mg',
  'vitaminB2Mg',
  'vitaminPpMg',
  'vitaminAMcg',
] as const satisfies readonly DefaultNutrientKey[];

export type DefaultNutrientKey = (typeof DEFAULT_NUTRIENTS)[number];
export type SupportedCandidateNutrient =
  (typeof SUPPORTED_CANDIDATE_NUTRIENTS)[number];

/**
 * Pre-built lookup set for `SUPPORTED_CANDIDATE_NUTRIENTS`. Use this instead of
 * constructing `new Set(SUPPORTED_CANDIDATE_NUTRIENTS)` in callsites.
 */
export const SUPPORTED_CANDIDATE_NUTRIENT_SET: ReadonlySet<string> = new Set(
  SUPPORTED_CANDIDATE_NUTRIENTS
);

export const NUTRIENT_META: Record<NutritionNutrientKey, NutrientMeta> = {
  fiberG: {
    key: 'fiberG',
    dbColumn: 'fiber_g',
    labelKey: 'nutrition.nutrients.fiber',
    unit: 'g',
    group: 'other',
  },
  sodiumMg: {
    key: 'sodiumMg',
    dbColumn: 'sodium_mg',
    labelKey: 'nutrition.nutrients.sodium',
    unit: 'mg',
    group: 'mineral',
  },
  calciumMg: {
    key: 'calciumMg',
    dbColumn: 'calcium_mg',
    labelKey: 'nutrition.nutrients.calcium',
    unit: 'mg',
    group: 'mineral',
  },
  ironMg: {
    key: 'ironMg',
    dbColumn: 'iron_mg',
    labelKey: 'nutrition.nutrients.iron',
    unit: 'mg',
    group: 'mineral',
  },
  magnesiumMg: {
    key: 'magnesiumMg',
    dbColumn: 'magnesium_mg',
    labelKey: 'nutrition.nutrients.magnesium',
    unit: 'mg',
    group: 'mineral',
  },
  phosphorusMg: {
    key: 'phosphorusMg',
    dbColumn: 'phosphorus_mg',
    labelKey: 'nutrition.nutrients.phosphorus',
    unit: 'mg',
    group: 'mineral',
  },
  potassiumMg: {
    key: 'potassiumMg',
    dbColumn: 'potassium_mg',
    labelKey: 'nutrition.nutrients.potassium',
    unit: 'mg',
    group: 'mineral',
  },
  zincMg: {
    key: 'zincMg',
    dbColumn: 'zinc_mg',
    labelKey: 'nutrition.nutrients.zinc',
    unit: 'mg',
    group: 'mineral',
  },
  copperMcg: {
    key: 'copperMcg',
    dbColumn: 'copper_mcg',
    labelKey: 'nutrition.nutrients.copper',
    unit: 'mcg',
    group: 'mineral',
  },
  manganeseMg: {
    key: 'manganeseMg',
    dbColumn: 'manganese_mg',
    labelKey: 'nutrition.nutrients.manganese',
    unit: 'mg',
    group: 'mineral',
  },
  betaCaroteneMcg: {
    key: 'betaCaroteneMcg',
    dbColumn: 'beta_carotene_mcg',
    labelKey: 'nutrition.nutrients.betaCarotene',
    unit: 'mcg',
    group: 'vitamin',
  },
  vitaminAMcg: {
    key: 'vitaminAMcg',
    dbColumn: 'vitamin_a_mcg',
    labelKey: 'nutrition.nutrients.vitaminA',
    unit: 'mcg',
    group: 'vitamin',
  },
  vitaminDMcg: {
    key: 'vitaminDMcg',
    dbColumn: 'vitamin_d_mcg',
    labelKey: 'nutrition.nutrients.vitaminD',
    unit: 'mcg',
    group: 'vitamin',
  },
  vitaminEMg: {
    key: 'vitaminEMg',
    dbColumn: 'vitamin_e_mg',
    labelKey: 'nutrition.nutrients.vitaminE',
    unit: 'mg',
    group: 'vitamin',
  },
  vitaminKMcg: {
    key: 'vitaminKMcg',
    dbColumn: 'vitamin_k_mcg',
    labelKey: 'nutrition.nutrients.vitaminK',
    unit: 'mcg',
    group: 'vitamin',
  },
  vitaminCMg: {
    key: 'vitaminCMg',
    dbColumn: 'vitamin_c_mg',
    labelKey: 'nutrition.nutrients.vitaminC',
    unit: 'mg',
    group: 'vitamin',
  },
  vitaminB1Mg: {
    key: 'vitaminB1Mg',
    dbColumn: 'vitamin_b1_mg',
    labelKey: 'nutrition.nutrients.vitaminB1',
    unit: 'mg',
    group: 'vitamin',
  },
  vitaminB2Mg: {
    key: 'vitaminB2Mg',
    dbColumn: 'vitamin_b2_mg',
    labelKey: 'nutrition.nutrients.vitaminB2',
    unit: 'mg',
    group: 'vitamin',
  },
  vitaminPpMg: {
    key: 'vitaminPpMg',
    dbColumn: 'vitamin_pp_mg',
    labelKey: 'nutrition.nutrients.vitaminPp',
    unit: 'mg',
    group: 'vitamin',
  },
  vitaminB5Mg: {
    key: 'vitaminB5Mg',
    dbColumn: 'vitamin_b5_mg',
    labelKey: 'nutrition.nutrients.vitaminB5',
    unit: 'mg',
    group: 'vitamin',
  },
  vitaminB6Mg: {
    key: 'vitaminB6Mg',
    dbColumn: 'vitamin_b6_mg',
    labelKey: 'nutrition.nutrients.vitaminB6',
    unit: 'mg',
    group: 'vitamin',
  },
  vitaminB9Mcg: {
    key: 'vitaminB9Mcg',
    dbColumn: 'vitamin_b9_mcg',
    labelKey: 'nutrition.nutrients.vitaminB9',
    unit: 'mcg',
    group: 'vitamin',
  },
  vitaminB12Mcg: {
    key: 'vitaminB12Mcg',
    dbColumn: 'vitamin_b12_mcg',
    labelKey: 'nutrition.nutrients.vitaminB12',
    unit: 'mcg',
    group: 'vitamin',
  },
  vitaminHMcg: {
    key: 'vitaminHMcg',
    dbColumn: 'vitamin_h_mcg',
    labelKey: 'nutrition.nutrients.vitaminH',
    unit: 'mcg',
    group: 'vitamin',
  },
};

export function getNutrientMeta(key: NutritionNutrientKey): NutrientMeta {
  return NUTRIENT_META[key];
}
