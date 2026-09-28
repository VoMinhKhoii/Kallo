import {
  type NutritionValues,
  OCR_NUTRIENT_KEYS,
  type OcrQuantityUnit,
} from '@/lib/domain/nutrition/ocr/schema';
import {
  editScanFood,
  REQUIRED_SCAN_NUTRIENTS,
  type ScanFood,
} from '@/lib/domain/scan/food';
import { isAcceptedNutrient } from '@/lib/domain/scan/nutrients';

/**
 * The editor's rules — the Flutter app's `ScanEditorDraft`, as pure functions
 * over what the user typed: blank is unknown (null), 0 is zero, anything
 * typed must parse and stay in the log's range, and Done waits for a name and
 * the four the log requires.
 */

/** What the values are per: 100 g, 100 ml, a serving, or the source's own. */
export interface ScanBasis {
  amount: number;
  unit: OcrQuantityUnit;
}

export type ScanFieldTexts = Record<keyof NutritionValues, string>;

/** The server's product-name limit. */
const MAX_NAME = 200;

/** A plain positive decimal, tolerating the comma a VN keyboard types.
 *  Stricter than `Number()`, which would take "1e3", "-5" and "Infinity". */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim().replace(/\s/g, '');
  if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/** Two decimals at most, no trailing ".0". */
export const formatDecimal = (value: number) =>
  String(Math.round(value * 100) / 100);

export function fieldTexts(values: NutritionValues): ScanFieldTexts {
  return Object.fromEntries(
    OCR_NUTRIENT_KEYS.map((key) => [
      key,
      values[key] === null ? '' : formatDecimal(values[key] as number),
    ])
  ) as ScanFieldTexts;
}

/** A typed value that will not be accepted: malformed or out of range. */
export function fieldError(key: keyof NutritionValues, text: string): boolean {
  if (!text.trim()) return false;
  const value = parseDecimal(text);
  return value === null || !isAcceptedNutrient(key, value);
}

/** Done's rule: a name, nothing malformed, and the four the log requires. */
export function isDraftValid(name: string, fields: ScanFieldTexts): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > MAX_NAME) return false;
  if (OCR_NUTRIENT_KEYS.some((key) => fieldError(key, fields[key]))) {
    return false;
  }
  return REQUIRED_SCAN_NUTRIENTS.every(
    (key) => parseDecimal(fields[key]) !== null
  );
}

/** The three bases always offered, plus the source's own when it differs. */
export function basesFor(source: ScanBasis): ScanBasis[] {
  const bases: ScanBasis[] = [
    { amount: 100, unit: 'g' },
    { amount: 100, unit: 'ml' },
    { amount: 1, unit: 'serving' },
  ];
  const own = bases.some(
    (b) => b.amount === source.amount && b.unit === source.unit
  );
  return own ? bases : [...bases, source];
}

/** The edited food. The values are what was typed FOR `basis` — a new basis
 *  relabels them, it never rescales them. */
export function draftToFood(
  source: ScanFood,
  {
    name,
    basis,
    fields,
  }: { name: string; basis: ScanBasis; fields: ScanFieldTexts }
): ScanFood {
  return editScanFood(source, {
    name: name.trim(),
    unit: basis.unit,
    basisAmount: basis.amount,
    values: Object.fromEntries(
      OCR_NUTRIENT_KEYS.map((key) => [key, parseDecimal(fields[key])])
    ) as NutritionValues,
  });
}
