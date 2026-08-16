import { z } from 'zod';
import {
  type NutritionValues,
  nutritionLabelScanSchema,
  type OcrConfidence,
  type OcrErrorCode,
  type ParsedNutritionLabel,
} from '@/lib/nutrition/ocr-schema';

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

type RawAmount = z.infer<typeof rawAmountSchema>;
type RawNutritionValues = z.infer<typeof rawNutritionValuesSchema>;

const NUTRIENT_KEYS = Object.keys(rawNutritionValuesShape) as Array<
  keyof NutritionValues
>;

const GRAM_NUTRIENTS = new Set<keyof NutritionValues>([
  'proteinGrams',
  'carbsGrams',
  'fatGrams',
  'fiberGrams',
]);

const MICROGRAM_NUTRIENTS = new Set<keyof NutritionValues>([
  'copperMcg',
  'betaCaroteneMcg',
  'vitaminAMcg',
  'vitaminDMcg',
  'vitaminKMcg',
  'vitaminB9Mcg',
  'vitaminB12Mcg',
  'vitaminHMcg',
]);

export class NutritionLabelOcrError extends Error {
  constructor(public readonly code: OcrErrorCode) {
    super(code);
    this.name = 'NutritionLabelOcrError';
  }
}

function parsePrintedNumber(token: string): number | null {
  const compact = token
    .trim()
    .replace(/[\s\u00a0']/g, '')
    .replace(/[−–—]/g, '-');
  if (!compact || compact.includes('%') || !/^[+-]?[\d.,]+$/.test(compact)) {
    return null;
  }

  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  let normalized = compact;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const groupingSeparator = decimalSeparator === ',' ? /\./g : /,/g;
    normalized = compact.replace(groupingSeparator, '');
    normalized = normalized.replace(decimalSeparator, '.');
  } else if (lastComma >= 0) {
    normalized = compact.replace(/,/g, '.');
  }

  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizeUnitToken(token: string): string {
  return token.trim().toLowerCase().replace(/[µμ]/g, 'u').replace(/[.\s]/g, '');
}

function isPercentageToken(value: string, unit: string): boolean {
  const token = `${value} ${unit}`.toLowerCase();
  return (
    token.includes('%') ||
    /\b(?:dv|ri|nrv)\b/.test(token) ||
    token.includes('dailyvalue') ||
    token.includes('referenceintake')
  );
}

function convertMass(
  value: number,
  sourceUnit: string,
  targetUnit: 'g' | 'mg' | 'mcg'
): number | null {
  const sourceInGrams: Record<string, number> = {
    g: 1,
    gram: 1,
    grams: 1,
    mg: 0.001,
    milligram: 0.001,
    milligrams: 0.001,
    mcg: 0.000001,
    ug: 0.000001,
    microgram: 0.000001,
    micrograms: 0.000001,
  };
  const targetInGrams = { g: 1, mg: 0.001, mcg: 0.000001 };
  const factor = sourceInGrams[sourceUnit];
  return factor === undefined
    ? null
    : (value * factor) / targetInGrams[targetUnit];
}

function normalizeAmount(
  raw: RawAmount,
  nutrient: keyof NutritionValues
): number | null {
  if (!raw || isPercentageToken(raw.value, raw.unit)) return null;
  const value = parsePrintedNumber(raw.value);
  if (value === null) return null;
  const unit = normalizeUnitToken(raw.unit).split('/')[0];

  if (nutrient === 'calories') {
    if (['kcal', 'cal', 'calorie', 'calories'].includes(unit)) return value;
    if (['kj', 'kilojoule', 'kilojoules'].includes(unit)) {
      return value / 4.184;
    }
    return null;
  }

  if (unit === 'iu') {
    if (nutrient === 'vitaminAMcg') return value * 0.3;
    if (nutrient === 'vitaminDMcg') return value * 0.025;
    return null;
  }

  const targetUnit = GRAM_NUTRIENTS.has(nutrient)
    ? 'g'
    : MICROGRAM_NUTRIENTS.has(nutrient)
      ? 'mcg'
      : 'mg';
  return convertMass(value, unit, targetUnit);
}

function normalizeNutritionColumn(raw: RawNutritionValues): NutritionValues {
  return Object.fromEntries(
    NUTRIENT_KEYS.map((key) => [key, normalizeAmount(raw[key], key)])
  ) as NutritionValues;
}

function parsePositiveNumber(value: string | null): number | null {
  if (value === null) return null;
  const parsed = parsePrintedNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function normalizeMeasure(raw: z.infer<typeof rawMeasureSchema>) {
  if (!raw) return null;
  const value = parsePositiveNumber(raw.value);
  const unit = normalizeUnitToken(raw.unit);
  if (value === null || (unit !== 'g' && unit !== 'ml')) return null;
  return { value, unit } as const;
}

function hasMaterialMacroDisagreement(values: NutritionValues): boolean {
  const { calories, proteinGrams, carbsGrams, fatGrams } = values;
  if (
    calories === null ||
    proteinGrams === null ||
    carbsGrams === null ||
    fatGrams === null
  ) {
    return false;
  }

  const macroCalories = proteinGrams * 4 + carbsGrams * 4 + fatGrams * 9;
  const tolerance = Math.max(50, Math.max(calories, macroCalories) * 0.25);
  return Math.abs(calories - macroCalories) > tolerance;
}

function applyPlausibilityConfidence(
  result: ParsedNutritionLabel
): ParsedNutritionLabel {
  const columns: NutritionValues[] = [];
  if ('per100g' in result) columns.push(result.per100g);
  if ('per100ml' in result) columns.push(result.per100ml);
  if ('perServing' in result) columns.push(result.perServing);
  if ('perContainer' in result) columns.push(result.perContainer);
  if (!columns.some(hasMaterialMacroDisagreement)) return result;
  return { ...result, confidence: 'low' as OcrConfidence };
}

function normalizedMetadata(
  raw: Exclude<RawNutritionLabelOcr, { labelDetected: false }>
) {
  const labelEvidence = raw.labelEvidence?.trim() ?? '';
  if (!labelEvidence) throw new NutritionLabelOcrError('no_label_detected');
  return {
    productName: raw.productName?.trim() || null,
    labelEvidence,
    servingSize: normalizeMeasure(raw.servingSize),
    servingSizeDescription: raw.servingSizeDescription?.trim() || null,
    servingsPerContainer: parsePositiveNumber(raw.servingsPerContainer),
    confidence: raw.confidence,
  };
}

/** Pure conversion boundary from untrusted printed OCR tokens to app units. */
export function normalizeNutritionLabelOcr(
  raw: RawNutritionLabelOcr
): ParsedNutritionLabel {
  if (!raw.labelDetected) {
    throw new NutritionLabelOcrError('no_label_detected');
  }

  const metadata = normalizedMetadata(raw);
  let candidate: unknown;
  switch (raw.basis) {
    case 'per_100g':
      candidate = {
        ...metadata,
        basis: raw.basis,
        per100g: normalizeNutritionColumn(raw.per100g),
      };
      break;
    case 'per_100ml':
      candidate = {
        ...metadata,
        basis: raw.basis,
        per100ml: normalizeNutritionColumn(raw.per100ml),
      };
      break;
    case 'per_serving':
      candidate = {
        ...metadata,
        basis: raw.basis,
        perServing: normalizeNutritionColumn(raw.perServing),
      };
      break;
    case 'per_container': {
      const netContent = normalizeMeasure(raw.netContent);
      if (!netContent || metadata.servingsPerContainer === null) {
        throw new NutritionLabelOcrError('no_label_detected');
      }
      candidate = {
        ...metadata,
        basis: raw.basis,
        netContent,
        servingsPerContainer: metadata.servingsPerContainer,
        perContainer: normalizeNutritionColumn(raw.perContainer),
      };
      break;
    }
    case 'per_100g_and_serving':
      candidate = {
        ...metadata,
        basis: raw.basis,
        per100g: normalizeNutritionColumn(raw.per100g),
        perServing: normalizeNutritionColumn(raw.perServing),
      };
      break;
    case 'per_100ml_and_serving':
      candidate = {
        ...metadata,
        basis: raw.basis,
        per100ml: normalizeNutritionColumn(raw.per100ml),
        perServing: normalizeNutritionColumn(raw.perServing),
      };
      break;
  }

  const parsed = nutritionLabelScanSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new NutritionLabelOcrError('no_label_detected');
  }
  return applyPlausibilityConfidence(parsed.data);
}
