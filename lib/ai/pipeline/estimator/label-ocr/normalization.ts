/**
 * Raw OCR transcription → `ParsedNutritionLabel`.
 *
 * Assembles the app-shaped label from the printed tokens: converts every
 * nutrient column through `units.ts`, carries the metadata, re-validates
 * against the app schema, and downgrades confidence when the printed calories
 * and the 4/4/9 macro sum materially disagree. Anything unusable throws
 * `NutritionLabelOcrError('no_label_detected')` — a partially-read label is
 * never returned.
 */

import {
  type NutritionValues,
  nutritionLabelScanSchema,
  type OcrConfidence,
  type OcrErrorCode,
  type ParsedNutritionLabel,
} from '@/lib/domain/nutrition/ocr-schema';
import {
  NUTRIENT_KEYS,
  type RawNutritionLabelOcr,
  type RawNutritionValues,
} from './raw-schema';
import {
  normalizeAmount,
  normalizeMeasure,
  parsePositiveNumber,
} from './units';

export class NutritionLabelOcrError extends Error {
  constructor(public readonly code: OcrErrorCode) {
    super(code);
    this.name = 'NutritionLabelOcrError';
  }
}

function normalizeNutritionColumn(raw: RawNutritionValues): NutritionValues {
  return Object.fromEntries(
    NUTRIENT_KEYS.map((key) => [key, normalizeAmount(raw[key], key)])
  ) as NutritionValues;
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
