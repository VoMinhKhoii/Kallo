/**
 * The raw wire shape the OCR model must emit — printed tokens, not numbers.
 *
 * Every nutrient arrives as the value string and unit token exactly as printed
 * on the packaging ("1,5" + "g", "840" + "kJ", "25" + "% DV"). Conversion is
 * deliberately NOT the model's job: `units.ts` does it deterministically and
 * `normalization.ts` assembles the result. Keeping the schema here means the
 * prompt's contract has one declaration site.
 */

import { z } from 'zod';
import type { NutritionValues } from '@/lib/domain/nutrition/ocr/schema';

const rawAmountSchema = z
  .object({
    value: z.string(),
    unit: z.string(),
  })
  .strict()
  .nullable();

const rawNutritionValuesShape = {
  calories: rawAmountSchema,
  proteinGrams: rawAmountSchema,
  carbsGrams: rawAmountSchema,
  fatGrams: rawAmountSchema,
  fiberGrams: rawAmountSchema,
  sodiumMg: rawAmountSchema,
  calciumMg: rawAmountSchema,
  ironMg: rawAmountSchema,
  magnesiumMg: rawAmountSchema,
  phosphorusMg: rawAmountSchema,
  potassiumMg: rawAmountSchema,
  zincMg: rawAmountSchema,
  copperMcg: rawAmountSchema,
  manganeseMg: rawAmountSchema,
  betaCaroteneMcg: rawAmountSchema,
  vitaminAMcg: rawAmountSchema,
  vitaminCMg: rawAmountSchema,
  vitaminDMcg: rawAmountSchema,
  vitaminEMg: rawAmountSchema,
  vitaminKMcg: rawAmountSchema,
  vitaminB1Mg: rawAmountSchema,
  vitaminB2Mg: rawAmountSchema,
  vitaminPpMg: rawAmountSchema,
  vitaminB5Mg: rawAmountSchema,
  vitaminB6Mg: rawAmountSchema,
  vitaminB9Mcg: rawAmountSchema,
  vitaminB12Mcg: rawAmountSchema,
  vitaminHMcg: rawAmountSchema,
};

const rawNutritionValuesSchema = z.object(rawNutritionValuesShape).strict();

const rawMeasureSchema = z
  .object({ value: z.string(), unit: z.string() })
  .strict()
  .nullable();

const rawLabelMetadataShape = {
  labelDetected: z.literal(true),
  productName: z.string().nullable(),
  labelEvidence: z.string().nullable(),
  servingSize: rawMeasureSchema,
  servingSizeDescription: z.string().nullable(),
  servingsPerContainer: z.string().nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
};

const detectedRawLabelSchema = z.discriminatedUnion('basis', [
  z
    .object({
      ...rawLabelMetadataShape,
      basis: z.literal('per_100g'),
      per100g: rawNutritionValuesSchema,
    })
    .strict(),
  z
    .object({
      ...rawLabelMetadataShape,
      basis: z.literal('per_100ml'),
      per100ml: rawNutritionValuesSchema,
    })
    .strict(),
  z
    .object({
      ...rawLabelMetadataShape,
      basis: z.literal('per_serving'),
      perServing: rawNutritionValuesSchema,
    })
    .strict(),
  z
    .object({
      ...rawLabelMetadataShape,
      basis: z.literal('per_container'),
      netContent: rawMeasureSchema,
      perContainer: rawNutritionValuesSchema,
    })
    .strict(),
  z
    .object({
      ...rawLabelMetadataShape,
      basis: z.literal('per_100g_and_serving'),
      per100g: rawNutritionValuesSchema,
      perServing: rawNutritionValuesSchema,
    })
    .strict(),
  z
    .object({
      ...rawLabelMetadataShape,
      basis: z.literal('per_100ml_and_serving'),
      per100ml: rawNutritionValuesSchema,
      perServing: rawNutritionValuesSchema,
    })
    .strict(),
]);

export const rawNutritionLabelOcrSchema = z.union([
  z.object({ labelDetected: z.literal(false) }).strict(),
  detectedRawLabelSchema,
]);

export type RawNutritionLabelOcr = z.infer<typeof rawNutritionLabelOcrSchema>;

export type RawAmount = z.infer<typeof rawAmountSchema>;
export type RawNutritionValues = z.infer<typeof rawNutritionValuesSchema>;
export type RawMeasure = z.infer<typeof rawMeasureSchema>;

export const NUTRIENT_KEYS = Object.keys(rawNutritionValuesShape) as Array<
  keyof NutritionValues
>;
