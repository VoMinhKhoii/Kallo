/**
 * Printed OCR token → app unit. The deterministic conversion boundary.
 *
 * Everything here takes untrusted transcribed strings ("1.234,5", "% DV",
 * "840 kJ", "1000 IU") and returns either a number in the app's canonical unit
 * for that nutrient or `null`. No schema knowledge, no label assembly — those
 * are `raw-schema.ts` and `normalization.ts`.
 */

import type { NutritionValues } from '@/lib/domain/nutrition/ocr/schema';
import type { RawAmount, RawMeasure } from './raw-schema';

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
    // Both present: the rightmost one is the decimal separator, the other
    // groups thousands. "1.234,5" (vi/EU) and "1,234.5" (US) both work.
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const groupingSeparator = decimalSeparator === ',' ? /\./g : /,/g;
    normalized = compact.replace(groupingSeparator, '');
    normalized = normalized.replace(decimalSeparator, '.');
  } else if (lastComma >= 0 || lastDot >= 0) {
    // Only one separator kind: it is ambiguous on its own, because "1,5" is
    // one and a half on a Vietnamese label while "1,000" is a thousand on a
    // US one. Groups of exactly three digits mean thousands; nutrition
    // labels never print three decimal places.
    const separator = lastComma >= 0 ? ',' : '.';
    const escaped = separator === ',' ? ',' : '\\.';
    const grouped = new RegExp(`^[+-]?\\d{1,3}(?:${escaped}\\d{3})+$`);
    normalized = grouped.test(compact)
      ? compact.replaceAll(separator, '')
      : compact.replace(separator, '.');
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

export function normalizeAmount(
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

export function parsePositiveNumber(value: string | null): number | null {
  if (value === null) return null;
  const parsed = parsePrintedNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

export function normalizeMeasure(raw: RawMeasure) {
  if (!raw) return null;
  const value = parsePositiveNumber(raw.value);
  const unit = normalizeUnitToken(raw.unit);
  if (value === null || (unit !== 'g' && unit !== 'ml')) return null;
  return { value, unit } as const;
}
