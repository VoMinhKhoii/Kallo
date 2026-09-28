import {
  type NutritionValues,
  nutritionValuesSchema,
} from '@/lib/domain/nutrition/ocr/schema';

/** One nutrient a scan result shows: its label-log key, its message key under
 *  `logging.ocrNutrients`, and its unit. */
export interface ScanNutrientDefinition {
  key: keyof NutritionValues;
  labelKey: string;
  unit: string;
}

/** Calories and the three macros — the four the log requires. */
export const SCAN_MACRO_DEFINITIONS: ScanNutrientDefinition[] = [
  { key: 'calories', labelKey: 'calories', unit: 'kcal' },
  { key: 'proteinGrams', labelKey: 'protein', unit: 'g' },
  { key: 'carbsGrams', labelKey: 'carbohydrates', unit: 'g' },
  { key: 'fatGrams', labelKey: 'fat', unit: 'g' },
];

/** Every other nutrient the app knows, in the label's order. */
export const SCAN_MICRONUTRIENT_DEFINITIONS: ScanNutrientDefinition[] = [
  { key: 'fiberGrams', labelKey: 'fiber', unit: 'g' },
  { key: 'sodiumMg', labelKey: 'sodium', unit: 'mg' },
  { key: 'calciumMg', labelKey: 'calcium', unit: 'mg' },
  { key: 'ironMg', labelKey: 'iron', unit: 'mg' },
  { key: 'magnesiumMg', labelKey: 'magnesium', unit: 'mg' },
  { key: 'phosphorusMg', labelKey: 'phosphorus', unit: 'mg' },
  { key: 'potassiumMg', labelKey: 'potassium', unit: 'mg' },
  { key: 'zincMg', labelKey: 'zinc', unit: 'mg' },
  { key: 'copperMcg', labelKey: 'copper', unit: 'mcg' },
  { key: 'manganeseMg', labelKey: 'manganese', unit: 'mg' },
  { key: 'betaCaroteneMcg', labelKey: 'betaCarotene', unit: 'mcg' },
  { key: 'vitaminAMcg', labelKey: 'vitaminA', unit: 'mcg' },
  { key: 'vitaminCMg', labelKey: 'vitaminC', unit: 'mg' },
  { key: 'vitaminDMcg', labelKey: 'vitaminD', unit: 'mcg' },
  { key: 'vitaminEMg', labelKey: 'vitaminE', unit: 'mg' },
  { key: 'vitaminKMcg', labelKey: 'vitaminK', unit: 'mcg' },
  { key: 'vitaminB1Mg', labelKey: 'vitaminB1', unit: 'mg' },
  { key: 'vitaminB2Mg', labelKey: 'vitaminB2', unit: 'mg' },
  { key: 'vitaminPpMg', labelKey: 'vitaminPp', unit: 'mg' },
  { key: 'vitaminB5Mg', labelKey: 'vitaminB5', unit: 'mg' },
  { key: 'vitaminB6Mg', labelKey: 'vitaminB6', unit: 'mg' },
  { key: 'vitaminB9Mcg', labelKey: 'vitaminB9', unit: 'mcg' },
  { key: 'vitaminB12Mcg', labelKey: 'vitaminB12', unit: 'mcg' },
  { key: 'vitaminHMcg', labelKey: 'vitaminH', unit: 'mcg' },
];

/** Whether `value` is one the label log accepts for `key` (in range). */
export const isAcceptedNutrient = (
  key: keyof NutritionValues,
  value: number
): boolean => nutritionValuesSchema.shape[key].safeParse(value).success;
