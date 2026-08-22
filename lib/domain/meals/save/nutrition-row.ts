'use client';

import type { NutritionValues } from '@/lib/ai/types/nutrition-values';
import { NUTRITION_KEYS } from '@/lib/ai/types/nutrition-values';
import type { MacroBreakdown } from '@/lib/core/types/meal';

// The persisted-meal nutrition row an optimistic card carries: every micro
// null (the server response fills them in), the four macros mapped across
// from the pipeline's MacroBreakdown.

export const EMPTY_NUTRITION = Object.fromEntries(
  NUTRITION_KEYS.map((key) => [key, null])
) as unknown as NutritionValues;

export function macrosToNutrition(macros: MacroBreakdown): NutritionValues {
  return {
    ...EMPTY_NUTRITION,
    caloriesKcal: macros.calories,
    proteinG: macros.protein,
    carbohydrateG: macros.carbs,
    fatG: macros.fat,
  };
}
