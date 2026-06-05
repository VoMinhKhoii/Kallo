/**
 * The supported food-source-candidate nutrients, vendored as consts from web
 * `lib/nutrition/catalog/nutrients.ts` (keep in sync). Only the candidate
 * gating is needed on mobile — `NUTRIENT_META`/`DEFAULT_NUTRIENTS` are not.
 */
import type { SupportedCandidateNutrient } from '@/lib/api/contracts/nutrition';
import type { NutritionNutrientKey } from '@/lib/nutrition/types';

export const SUPPORTED_CANDIDATE_NUTRIENTS = [
  'calciumMg',
  'ironMg',
  'vitaminCMg',
  'phosphorusMg',
  'vitaminB1Mg',
  'vitaminB2Mg',
  'vitaminPpMg',
  'vitaminAMcg',
] as const satisfies readonly SupportedCandidateNutrient[];

export const SUPPORTED_CANDIDATE_NUTRIENT_SET: ReadonlySet<string> = new Set(
  SUPPORTED_CANDIDATE_NUTRIENTS
);

/** Narrows a nutrient key to a supported candidate nutrient, or null. */
export function asSupported(
  nutrient: NutritionNutrientKey
): SupportedCandidateNutrient | null {
  return SUPPORTED_CANDIDATE_NUTRIENT_SET.has(nutrient)
    ? (nutrient as SupportedCandidateNutrient)
    : null;
}
