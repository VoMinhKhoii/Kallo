import { NUTRITION_KEYS } from '@/lib/ai/constants';
import type { NutritionValues } from '@/lib/ai/types';

/** All nutrient keys null — base for building a sparse NutritionValues. */
export const EMPTY_NUTRITION = Object.fromEntries(
  NUTRITION_KEYS.map((key) => [key, null])
) as unknown as NutritionValues;
