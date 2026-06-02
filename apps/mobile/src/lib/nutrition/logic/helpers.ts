/**
 * Vendored verbatim from web `components/nutrition/primitives/helpers.ts`
 * (keep in sync). Pure functions — the web file value-imports nothing but a
 * type, so this is a 1:1 copy with the type kept as a `@/lib` type-only import.
 */
import type { NutrientType } from '@/lib/nutrition/types';

/**
 * Whether a nutrient with the given type & % of target should render the
 * coral exceed indicator (danger color, +N% figure, coral end-tick).
 *
 * - floor: never (above 100% on a minimum is good — RDAs are floors).
 * - ceiling: above 100% (e.g. sodium).
 * - range: outside ±10% band (e.g. calories on maintenance).
 */
export function shouldShowExceed(
  type: NutrientType,
  pct: number | null
): boolean {
  if (pct === null) return false;
  if (type === 'floor') return false;
  if (type === 'ceiling') return pct > 100;
  if (type === 'range') return pct > 110 || pct < 90;
  return false;
}

/**
 * Locale-aware number formatter used across nutrition cards. Drops fraction
 * digits at >=100 to keep large grams and mg values compact, otherwise shows
 * a single decimal so e.g. 0.5g stays meaningful.
 */
export function formatLocalizedNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);
}
