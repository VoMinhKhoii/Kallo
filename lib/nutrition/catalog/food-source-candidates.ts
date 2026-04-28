import type { SupportedCandidateNutrient } from './nutrients';

export interface FoodSourceCandidate {
  readonly nutrient: SupportedCandidateNutrient;
  readonly id: string;
  readonly nameKey: string;
  readonly servingKey: string;
  readonly rationaleKey: string;
  readonly cautionKey?: string;
}

const c = (
  nutrient: SupportedCandidateNutrient,
  id: string,
  caution = false
): FoodSourceCandidate =>
  Object.freeze({
    nutrient,
    id,
    nameKey: `nutrition.candidates.${nutrient}.${id}.name`,
    servingKey: `nutrition.candidates.${nutrient}.${id}.serving`,
    rationaleKey: `nutrition.candidates.${nutrient}.${id}.rationale`,
    cautionKey: caution
      ? `nutrition.candidates.${nutrient}.${id}.caution`
      : undefined,
  });

const freezeCandidates = (
  candidates: readonly FoodSourceCandidate[]
): readonly FoodSourceCandidate[] => Object.freeze([...candidates]);

export const CURATED_FOOD_SOURCE_CANDIDATES: Readonly<
  Record<SupportedCandidateNutrient, readonly FoodSourceCandidate[]>
> = Object.freeze({
  calciumMg: freezeCandidates([
    c('calciumMg', 'tofu'),
    c('calciumMg', 'smallFishWithBones'),
    c('calciumMg', 'yogurt'),
    c('calciumMg', 'mustardGreens'),
    c('calciumMg', 'soyMilk'),
  ]),
  ironMg: freezeCandidates([
    c('ironMg', 'clams'),
    c('ironMg', 'leanBeef'),
    c('ironMg', 'porkLiver', true),
    c('ironMg', 'waterSpinach'),
    c('ironMg', 'mungBeans'),
  ]),
  vitaminCMg: freezeCandidates([
    c('vitaminCMg', 'guava'),
    c('vitaminCMg', 'pomelo'),
    c('vitaminCMg', 'papaya'),
    c('vitaminCMg', 'mustardGreens'),
    c('vitaminCMg', 'freshHerbs'),
  ]),
  phosphorusMg: freezeCandidates([
    c('phosphorusMg', 'fish'),
    c('phosphorusMg', 'eggs'),
    c('phosphorusMg', 'tofu'),
    c('phosphorusMg', 'chicken'),
    c('phosphorusMg', 'peanuts'),
  ]),
  vitaminB1Mg: freezeCandidates([
    c('vitaminB1Mg', 'pork'),
    c('vitaminB1Mg', 'mungBeans'),
    c('vitaminB1Mg', 'brownRice'),
    c('vitaminB1Mg', 'peanuts'),
    c('vitaminB1Mg', 'soybeans'),
  ]),
  vitaminB2Mg: freezeCandidates([
    c('vitaminB2Mg', 'eggs'),
    c('vitaminB2Mg', 'yogurt'),
    c('vitaminB2Mg', 'porkLiver', true),
    c('vitaminB2Mg', 'fish'),
    c('vitaminB2Mg', 'mushrooms'),
  ]),
  vitaminPpMg: freezeCandidates([
    c('vitaminPpMg', 'chicken'),
    c('vitaminPpMg', 'fish'),
    c('vitaminPpMg', 'peanuts'),
    c('vitaminPpMg', 'leanPork'),
    c('vitaminPpMg', 'mushrooms'),
  ]),
  vitaminAMcg: freezeCandidates([
    c('vitaminAMcg', 'carrots'),
    c('vitaminAMcg', 'pumpkin'),
    c('vitaminAMcg', 'sweetPotato'),
    c('vitaminAMcg', 'eggYolk'),
    c('vitaminAMcg', 'darkLeafyGreens'),
  ]),
});

const EMPTY_CANDIDATES = Object.freeze([]) as readonly FoodSourceCandidate[];

export function getCuratedFoodSourceCandidates(
  nutrient: SupportedCandidateNutrient
): readonly FoodSourceCandidate[] {
  return CURATED_FOOD_SOURCE_CANDIDATES[nutrient] ?? EMPTY_CANDIDATES;
}
