import { z } from 'zod';

export type OcrErrorCode =
  | 'invalid_image'
  | 'no_label_detected'
  | 'rate_limited'
  | 'server_error';

export const OCR_CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export const ocrConfidenceSchema = z.enum(OCR_CONFIDENCE_LEVELS);

const nutrientAmount = (maximum: number, unit: string) =>
  z
    .number()
    .finite()
    .nonnegative()
    .max(maximum)
    .nullable()
    .describe(`Absolute amount in ${unit}; null when not printed on the label`);

export const nutritionValuesSchema = z
  .object({
    calories: nutrientAmount(20_000, 'kcal'),
    proteinGrams: nutrientAmount(5_000, 'grams'),
    carbsGrams: nutrientAmount(5_000, 'grams'),
    fatGrams: nutrientAmount(5_000, 'grams'),
    fiberGrams: nutrientAmount(2_000, 'grams'),
    sodiumMg: nutrientAmount(50_000, 'milligrams'),
    calciumMg: nutrientAmount(20_000, 'milligrams'),
    ironMg: nutrientAmount(1_000, 'milligrams'),
    magnesiumMg: nutrientAmount(20_000, 'milligrams'),
    phosphorusMg: nutrientAmount(20_000, 'milligrams'),
    potassiumMg: nutrientAmount(30_000, 'milligrams'),
    zincMg: nutrientAmount(1_000, 'milligrams'),
    copperMcg: nutrientAmount(1_000_000, 'micrograms'),
    manganeseMg: nutrientAmount(1_000, 'milligrams'),
    betaCaroteneMcg: nutrientAmount(1_000_000, 'micrograms'),
    vitaminAMcg: nutrientAmount(100_000, 'micrograms'),
    vitaminCMg: nutrientAmount(20_000, 'milligrams'),
    vitaminDMcg: nutrientAmount(10_000, 'micrograms'),
    vitaminEMg: nutrientAmount(10_000, 'milligrams'),
    vitaminKMcg: nutrientAmount(1_000_000, 'micrograms'),
    vitaminB1Mg: nutrientAmount(1_000, 'milligrams'),
    vitaminB2Mg: nutrientAmount(1_000, 'milligrams'),
    vitaminPpMg: nutrientAmount(5_000, 'milligrams'),
    vitaminB5Mg: nutrientAmount(1_000, 'milligrams'),
    vitaminB6Mg: nutrientAmount(1_000, 'milligrams'),
    vitaminB9Mcg: nutrientAmount(1_000_000, 'micrograms'),
    vitaminB12Mcg: nutrientAmount(1_000_000, 'micrograms'),
    vitaminHMcg: nutrientAmount(1_000_000, 'micrograms'),
  })
  .strict();

export type NutritionValues = z.infer<typeof nutritionValuesSchema>;

export const OCR_NUTRIENT_KEYS = Object.keys(
  nutritionValuesSchema.shape
) as Array<keyof NutritionValues>;

const REQUIRED_LABEL_NUTRIENTS: readonly (keyof NutritionValues)[] = [
  'calories',
  'proteinGrams',
  'carbsGrams',
  'fatGrams',
];

const nutritionColumnSchema = nutritionValuesSchema.refine(
  (values) =>
    REQUIRED_LABEL_NUTRIENTS.filter((key) => values[key] !== null).length >= 2,
  'At least two absolute calorie or macronutrient values are required'
);

const per100NutritionColumnSchema = nutritionColumnSchema.superRefine(
  (values, context) => {
    const densityMaximums: Partial<Record<keyof NutritionValues, number>> = {
      calories: 1_000,
      proteinGrams: 100,
      carbsGrams: 100,
      fatGrams: 100,
      fiberGrams: 100,
    };

    for (const [key, maximum] of Object.entries(densityMaximums)) {
      const value = values[key as keyof NutritionValues];
      if (value !== null && maximum !== undefined && value > maximum) {
        context.addIssue({
          code: 'too_big',
          maximum,
          origin: 'number',
          inclusive: true,
          path: [key],
          message: `${key} exceeds its per-100-unit maximum`,
        });
      }
    }
  }
);

export const labelMeasureSchema = z
  .object({
    value: z.number().finite().positive().max(100_000),
    unit: z.enum(['g', 'ml']),
  })
  .strict();

const labelMetadataShape = {
  productName: z.string().trim().min(1).max(200).nullable(),
  labelEvidence: z.string().trim().min(1).max(500),
  servingSize: labelMeasureSchema.nullable(),
  servingSizeDescription: z.string().trim().min(1).max(200).nullable(),
  servingsPerContainer: z.number().finite().positive().max(10_000).nullable(),
  confidence: ocrConfidenceSchema,
};

const per100gLabelSchema = z
  .object({
    ...labelMetadataShape,
    basis: z.literal('per_100g'),
    per100g: per100NutritionColumnSchema,
  })
  .strict();

const per100mlLabelSchema = z
  .object({
    ...labelMetadataShape,
    basis: z.literal('per_100ml'),
    per100ml: per100NutritionColumnSchema,
  })
  .strict();

const perServingLabelSchema = z
  .object({
    ...labelMetadataShape,
    basis: z.literal('per_serving'),
    perServing: nutritionColumnSchema,
  })
  .strict();

const perContainerLabelSchema = z
  .object({
    ...labelMetadataShape,
    basis: z.literal('per_container'),
    netContent: labelMeasureSchema,
    servingsPerContainer: z.number().finite().positive().max(10_000),
    perContainer: nutritionColumnSchema,
  })
  .strict();

const per100gAndServingLabelSchema = z
  .object({
    ...labelMetadataShape,
    basis: z.literal('per_100g_and_serving'),
    per100g: per100NutritionColumnSchema,
    perServing: nutritionColumnSchema,
  })
  .strict();

const per100mlAndServingLabelSchema = z
  .object({
    ...labelMetadataShape,
    basis: z.literal('per_100ml_and_serving'),
    per100ml: per100NutritionColumnSchema,
    perServing: nutritionColumnSchema,
  })
  .strict();

export const nutritionLabelScanSchema = z.discriminatedUnion('basis', [
  per100gLabelSchema,
  per100mlLabelSchema,
  perServingLabelSchema,
  perContainerLabelSchema,
  per100gAndServingLabelSchema,
  per100mlAndServingLabelSchema,
]);

export type ParsedNutritionLabel = z.infer<typeof nutritionLabelScanSchema>;
export type OcrConfidence = z.infer<typeof ocrConfidenceSchema>;
export type OcrQuantityUnit = 'g' | 'ml' | 'serving';

/**
 * What the review step submits. Calories and the three macros are required —
 * the step will not submit without them. Every other nutrient is optional: a
 * client may omit the ones the label never printed rather than send explicit
 * nulls, and staging reads them as `?? null` either way.
 */
export type OcrReviewPayload = Partial<
  Omit<NutritionValues, 'calories' | 'proteinGrams' | 'carbsGrams' | 'fatGrams'>
> & {
  productName: string;
  amount: number;
  unit: OcrQuantityUnit;
  confidence: OcrConfidence;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
};
