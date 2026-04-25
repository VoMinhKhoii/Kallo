import type { SupportedCandidateNutrient } from './nutrients';

export interface FoodSourceCandidate {
  nutrient: SupportedCandidateNutrient;
  id: string;
  nameKey: string;
  servingKey: string;
  rationaleKey: string;
  cautionKey?: string;
}

const c = (
  nutrient: SupportedCandidateNutrient,
  id: string,
  caution = false
): FoodSourceCandidate => ({
  nutrient,
  id,
  nameKey: `nutrition.candidates.${nutrient}.${id}.name`,
  servingKey: `nutrition.candidates.${nutrient}.${id}.serving`,
  rationaleKey: `nutrition.candidates.${nutrient}.${id}.rationale`,
  cautionKey: caution
    ? `nutrition.candidates.${nutrient}.${id}.caution`
    : undefined,
});

export const CURATED_FOOD_SOURCE_CANDIDATES: Record<
  SupportedCandidateNutrient,
  FoodSourceCandidate[]
> = {
  calciumMg: [
    c('calciumMg', 'tofu'),
    c('calciumMg', 'smallFishWithBones'),
    c('calciumMg', 'yogurt'),
    c('calciumMg', 'mustardGreens'),
    c('calciumMg', 'soyMilk'),
  ],
  ironMg: [
    c('ironMg', 'clams'),
    c('ironMg', 'leanBeef'),
    c('ironMg', 'porkLiver', true),
    c('ironMg', 'waterSpinach'),
    c('ironMg', 'mungBeans'),
  ],
  vitaminCMg: [
    c('vitaminCMg', 'guava'),
    c('vitaminCMg', 'pomelo'),
    c('vitaminCMg', 'papaya'),
    c('vitaminCMg', 'mustardGreens'),
    c('vitaminCMg', 'freshHerbs'),
  ],
  phosphorusMg: [
    c('phosphorusMg', 'fish'),
    c('phosphorusMg', 'eggs'),
    c('phosphorusMg', 'tofu'),
    c('phosphorusMg', 'chicken'),
    c('phosphorusMg', 'peanuts'),
  ],
  vitaminB1Mg: [
    c('vitaminB1Mg', 'pork'),
    c('vitaminB1Mg', 'mungBeans'),
    c('vitaminB1Mg', 'brownRice'),
    c('vitaminB1Mg', 'peanuts'),
    c('vitaminB1Mg', 'soybeans'),
  ],
  vitaminB2Mg: [
    c('vitaminB2Mg', 'eggs'),
    c('vitaminB2Mg', 'yogurt'),
    c('vitaminB2Mg', 'porkLiver', true),
    c('vitaminB2Mg', 'fish'),
    c('vitaminB2Mg', 'mushrooms'),
  ],
  vitaminPpMg: [
    c('vitaminPpMg', 'chicken'),
    c('vitaminPpMg', 'fish'),
    c('vitaminPpMg', 'peanuts'),
    c('vitaminPpMg', 'leanPork'),
    c('vitaminPpMg', 'mushrooms'),
  ],
  vitaminAMcg: [
    c('vitaminAMcg', 'carrots'),
    c('vitaminAMcg', 'pumpkin'),
    c('vitaminAMcg', 'sweetPotato'),
    c('vitaminAMcg', 'eggYolk'),
    c('vitaminAMcg', 'darkLeafyGreens'),
  ],
};

export function getCuratedFoodSourceCandidates(
  nutrient: SupportedCandidateNutrient
): FoodSourceCandidate[] {
  return CURATED_FOOD_SOURCE_CANDIDATES[nutrient] ?? [];
}
