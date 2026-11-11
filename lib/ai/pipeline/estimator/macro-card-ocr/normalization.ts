/**
 * Raw OCR transcription → `ParsedNutritionLabel` with `basis: 'per_serving'`.
 *
 * Normalizes 4 macros (calories, protein, carbs, fat) from untrusted printed
 * tokens. Unprinted nutrients stay null (never zero). Default unit rule applies:
 * an empty unit defaults to 'kcal' for calories and 'g' for macros.
 * Anything unusable throws `NutritionLabelOcrError('no_label_detected')`.
 */

import { NutritionLabelOcrError } from '@/lib/domain/nutrition/ocr/error';
import {
  isPercentageToken,
  normalizeUnitToken,
  parsePrintedNumber,
} from '@/lib/domain/nutrition/ocr/printed-units';
import {
  type NutritionValues,
  nutritionLabelScanSchema,
  type OcrConfidence,
  type ParsedNutritionLabel,
} from '@/lib/domain/nutrition/ocr/schema';
import type { RawCardAmount, RawMacroCardOcr } from './raw-schema';

export function normalizeCardAmount(
  raw: RawCardAmount,
  kind: 'calories' | 'macro'
): number | null {
  if (!raw || isPercentageToken(raw.value, raw.unit)) return null;
  const value = parsePrintedNumber(raw.value);
  if (value === null) return null;
  const unit = normalizeUnitToken(raw.unit).split('/')[0];

  if (kind === 'calories') {
    // Empty unit on calorie field defaults to kcal
    if (!unit || ['kcal', 'cal', 'calorie', 'calories'].includes(unit)) {
      return value;
    }
    if (['kj', 'kilojoule', 'kilojoules'].includes(unit)) {
      return value / 4.184;
    }
    return null;
  }

  // Macro fields: empty unit or explicit gram units default to grams
  if (!unit || ['g', 'gram', 'grams'].includes(unit)) {
    return value;
  }
  if (['mg', 'milligram', 'milligrams'].includes(unit)) {
    return value * 0.001;
  }
  return null;
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

/** Pure conversion boundary from untrusted card OCR tokens to app units. */
export function normalizeMacroCardOcr(
  raw: RawMacroCardOcr
): ParsedNutritionLabel {
  if (!raw.cardDetected) {
    throw new NutritionLabelOcrError('no_label_detected');
  }

  const evidence = raw.evidence?.trim() ?? '';
  if (!evidence) {
    throw new NutritionLabelOcrError('no_label_detected');
  }

  const calories = normalizeCardAmount(raw.calories, 'calories');
  const proteinGrams = normalizeCardAmount(raw.proteinGrams, 'macro');
  const carbsGrams = normalizeCardAmount(raw.carbsGrams, 'macro');
  const fatGrams = normalizeCardAmount(raw.fatGrams, 'macro');
  const fiberGrams = normalizeCardAmount(raw.fiberGrams ?? null, 'macro');

  // Must have calories OR all three macros to be a valid usable scan
  const hasCalories = calories !== null;
  const hasAllMacros =
    proteinGrams !== null && carbsGrams !== null && fatGrams !== null;
  if (!hasCalories && !hasAllMacros) {
    throw new NutritionLabelOcrError('no_label_detected');
  }

  // Derive calories via 4/4/9 when calories is unprinted on card but all 3 macros are explicitly given
  const effectiveCalories =
    calories ??
    (hasAllMacros
      ? Math.round(proteinGrams * 4 + carbsGrams * 4 + fatGrams * 9)
      : null);

  const perServing: NutritionValues = {
    calories: effectiveCalories,
    proteinGrams,
    carbsGrams,
    fatGrams,
    fiberGrams,
    sodiumMg: null,
    calciumMg: null,
    ironMg: null,
    magnesiumMg: null,
    phosphorusMg: null,
    potassiumMg: null,
    zincMg: null,
    copperMcg: null,
    manganeseMg: null,
    betaCaroteneMcg: null,
    vitaminAMcg: null,
    vitaminCMg: null,
    vitaminDMcg: null,
    vitaminEMg: null,
    vitaminKMcg: null,
    vitaminB1Mg: null,
    vitaminB2Mg: null,
    vitaminPpMg: null,
    vitaminB5Mg: null,
    vitaminB6Mg: null,
    vitaminB9Mcg: null,
    vitaminB12Mcg: null,
    vitaminHMcg: null,
  };

  const confidence: OcrConfidence = hasMaterialMacroDisagreement(perServing)
    ? 'low'
    : raw.confidence;

  const servingSizeDesc = raw.servingSizeDescription?.trim() || null;
  const servingMatch = servingSizeDesc?.match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i);
  const servingGramsValue = servingMatch
    ? parsePrintedNumber(servingMatch[1])
    : null;
  const servingSize =
    servingMatch && servingGramsValue && servingGramsValue > 0
      ? {
          value: servingGramsValue,
          unit:
            servingMatch[2].toLowerCase() === 'ml'
              ? ('ml' as const)
              : ('g' as const),
        }
      : null;

  const candidate = {
    basis: 'per_serving' as const,
    productName: raw.itemName?.trim() || null,
    labelEvidence: evidence,
    servingSize,
    servingSizeDescription: servingSizeDesc,
    servingsPerContainer: null,
    confidence,
    perServing,
  };

  const parsed = nutritionLabelScanSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new NutritionLabelOcrError('no_label_detected');
  }
  return parsed.data;
}
