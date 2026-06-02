/**
 * Pure daily-rhythm helpers vendored from web `components/nutrition/sections/
 * daily-rhythm.tsx` (keep in sync). `COMPOSITION_COLORS` swaps the web's
 * `var(--nham-macro-*)` for resolved mobile tokens.
 */
import type { MacroPattern } from '@/lib/nutrition/types';
import { colors } from '~/theme/tokens';

export const KCAL_PER_GRAM = {
  protein: 4,
  carbohydrate: 4,
  fat: 9,
} as const;

export const COMPOSITION_KEYS = ['protein', 'carbohydrate', 'fat'] as const;
export type CompositionKey = (typeof COMPOSITION_KEYS)[number];

export const COMPOSITION_COLORS: Record<CompositionKey, string> = {
  protein: colors.macroProtein,
  carbohydrate: colors.macroCarbs,
  fat: colors.macroFat,
};

export const COMPOSITION_SHORT: Record<CompositionKey, string> = {
  protein: 'P',
  carbohydrate: 'C',
  fat: 'F',
};

export const ORDERED_MACROS = [
  'protein',
  'carbohydrate',
  'fat',
  'fiber',
] as const;

export function consistencyLabelKey(pct: number | null): string {
  if (pct === null) return 'rhythm.consistency.noTarget';
  if (pct >= 80) return 'rhythm.consistency.steady';
  if (pct >= 55) return 'rhythm.consistency.rhythmic';
  if (pct >= 30) return 'rhythm.consistency.varies';
  return 'rhythm.consistency.thin';
}

export interface CompositionSegment {
  key: CompositionKey;
  pct: number;
}

/** Builds the macro composition (kcal-share) segments for the calorie pill. */
export function buildComposition(macros: MacroPattern[]): {
  totalKcal: number;
  segments: CompositionSegment[];
} {
  const composition = COMPOSITION_KEYS.map((key) => {
    const macro = macros.find((m) => m.key === key);
    if (!macro || macro.averagePerDay <= 0) {
      return { key, kcal: 0 };
    }
    return { key, kcal: macro.averagePerDay * KCAL_PER_GRAM[key] };
  });
  const totalKcal = composition.reduce((sum, c) => sum + c.kcal, 0);
  const segments = composition.map((c) => ({
    key: c.key,
    pct: totalKcal > 0 ? (c.kcal / totalKcal) * 100 : 0,
  }));
  return { totalKcal, segments };
}

/** The macro rows shown under the calorie pill, in the web's fixed order. */
export function orderedMacroRows(macros: MacroPattern[]): MacroPattern[] {
  return ORDERED_MACROS.map((key) => macros.find((m) => m.key === key)).filter(
    (m): m is MacroPattern => Boolean(m)
  );
}
