import type { ConfidenceDisplayState } from './types';

interface NutrientConfidenceInput {
  totalCalories: number;
  caloriesWithNutrientData: number;
}

interface NutrientDataCoverageItem {
  calories: number;
  nutrientValue: number | null | undefined;
}

interface ConfidenceMetadataInput extends NutrientConfidenceInput {}

export function getNutrientConfidence({
  totalCalories,
  caloriesWithNutrientData,
}: NutrientConfidenceInput): number {
  if (totalCalories <= 0) {
    return 0;
  }

  return Math.round((caloriesWithNutrientData / totalCalories) * 1000) / 10;
}

export function getCaloriesWithNutrientData(
  items: NutrientDataCoverageItem[]
): number {
  return items.reduce((total, item) => {
    if (item.nutrientValue === null || item.nutrientValue === undefined) {
      return total;
    }

    return total + Math.max(0, item.calories);
  }, 0);
}

export function getConfidenceMetadata({
  totalCalories,
  caloriesWithNutrientData,
}: ConfidenceMetadataInput): {
  confidence: number;
  caloriesMissingNutrientData: number;
} {
  return {
    confidence: getNutrientConfidence({
      totalCalories,
      caloriesWithNutrientData,
    }),
    caloriesMissingNutrientData: Math.max(
      0,
      totalCalories - caloriesWithNutrientData
    ),
  };
}

export function getConfidenceDisplayState(
  confidence: number
): ConfidenceDisplayState {
  if (confidence >= 70) {
    return 'normal';
  }

  if (confidence >= 40) {
    return 'limited_data';
  }

  if (confidence >= 20) {
    return 'warning_points';
  }

  return 'insufficient_data';
}
