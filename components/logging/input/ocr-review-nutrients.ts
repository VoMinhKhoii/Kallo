import type { NutritionValues } from '@/lib/domain/nutrition/ocr-schema';

export interface OcrNutrientDefinition {
  key: keyof NutritionValues;
  labelKey: string;
  unit: string;
}

export const OCR_MACRO_DEFINITIONS: OcrNutrientDefinition[] = [
  { key: 'calories', labelKey: 'calories', unit: 'kcal' },
  { key: 'proteinGrams', labelKey: 'protein', unit: 'g' },
  { key: 'carbsGrams', labelKey: 'carbohydrates', unit: 'g' },
  { key: 'fatGrams', labelKey: 'fat', unit: 'g' },
];

export const OCR_MICRONUTRIENT_DEFINITIONS: OcrNutrientDefinition[] = [
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
