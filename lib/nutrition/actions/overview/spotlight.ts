import type { NutrientCardData } from '../../types';

const SPOTLIGHT_LIMIT = 2;
const SPOTLIGHT_MIN_CONFIDENCE = 40;
const SPOTLIGHT_MAX_PERCENT = 90;

function isSpotlightCandidate(card: NutrientCardData): boolean {
  // Every default micronutrient can surface food candidates (the composition
  // table has a column for each), so the gate is purely confidence + gap.
  // `partitionSpotlight` is only ever called on the default micronutrients.
  return (
    card.confidence >= SPOTLIGHT_MIN_CONFIDENCE &&
    card.percentOfTarget !== null &&
    card.percentOfTarget < SPOTLIGHT_MAX_PERCENT
  );
}

export function partitionSpotlight(cards: NutrientCardData[]): {
  spotlight: NutrientCardData[];
  steady: NutrientCardData[];
} {
  const spotlight = cards
    .filter(isSpotlightCandidate)
    .sort((a, b) => (a.percentOfTarget ?? 999) - (b.percentOfTarget ?? 999))
    .slice(0, SPOTLIGHT_LIMIT);
  const spotlightSet = new Set(spotlight.map((card) => card.nutrient));
  const steady = cards.filter((card) => !spotlightSet.has(card.nutrient));
  return { spotlight, steady };
}
