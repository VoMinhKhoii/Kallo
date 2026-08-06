import { z } from 'zod';

export type OcrErrorCode =
  | 'invalid_image'
  | 'no_label_detected'
  | 'rate_limited'
  | 'server_error';

export const nutritionValuesSchema = z.object({
  calories: z.number().nullable().describe('Calories in kcal'),
  proteinGrams: z.number().nullable().describe('Protein in grams'),
  carbsGrams: z.number().nullable().describe('Carbohydrates in grams'),
  fatGrams: z.number().nullable().describe('Total Fat in grams'),
  fiberGrams: z
    .number()
    .nullable()
    .optional()
    .describe('Dietary Fiber in grams'),
  sodiumMg: z.number().nullable().optional().describe('Sodium in milligrams'),
  calciumMg: z.number().nullable().optional().describe('Calcium in milligrams'),
  ironMg: z.number().nullable().optional().describe('Iron in milligrams'),
  potassiumMg: z
    .number()
    .nullable()
    .optional()
    .describe('Potassium in milligrams'),
  vitaminAMcg: z.number().nullable().optional().describe('Vitamin A in mcg'),
  vitaminCMg: z.number().nullable().optional().describe('Vitamin C in mg'),
  vitaminDMcg: z.number().nullable().optional().describe('Vitamin D in mcg'),
});

export type NutritionValues = z.infer<typeof nutritionValuesSchema>;

export const nutritionLabelScanSchema = z.object({
  productName: z
    .string()
    .nullable()
    .optional()
    .describe('Product or brand name if visible on packaging'),
  servingSizeGrams: z
    .number()
    .nullable()
    .describe('Gram weight per serving (e.g. 45 for a 45g bar)'),
  servingSizeDescription: z
    .string()
    .nullable()
    .optional()
    .describe('Label text describing portion (e.g., "1 bar (45g)" or "100g")'),
  servingsPerContainer: z
    .number()
    .nullable()
    .optional()
    .describe('Total servings in container if stated'),
  basis: z
    .enum(['per_100g', 'per_serving', 'both'])
    .describe('Primary reference basis found on label'),
  per100g: nutritionValuesSchema
    .nullable()
    .optional()
    .describe('Nutritional values scaled per 100g/mL'),
  perServing: nutritionValuesSchema
    .nullable()
    .optional()
    .describe('Nutritional values scaled per 1 serving'),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe(
      'Overall extraction confidence based on image clarity and completeness'
    ),
});

export type ParsedNutritionLabel = z.infer<typeof nutritionLabelScanSchema>;
