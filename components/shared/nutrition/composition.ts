import { Beef, Droplet, type LucideIcon, Wheat } from 'lucide-react';

/**
 * Macro-composition primitives shared by the nutrition page, the dashboard
 * dock, the logging feed and the Circle feed: kcal-per-gram, the chart
 * pigments, the per-macro food glyphs, and the kcal-share split every surface
 * draws as one stacked bar.
 *
 * The pigments are the app-wide macro trio — one set everywhere, split by hue
 * so three of them can sit touching inside a 6–8px stacked bar and stay
 * legible.
 *
 * Mirrors `apps/mobile-flutter/lib/shared/logic/macro_composition.dart` (keep
 * in sync).
 */

export const KCAL_PER_GRAM = { protein: 4, carbohydrate: 4, fat: 9 } as const;

export const COMPOSITION_KEYS = ['protein', 'carbohydrate', 'fat'] as const;
export type CompositionKey = (typeof COMPOSITION_KEYS)[number];

export const COMPOSITION_COLORS: Record<CompositionKey, string> = {
  protein: 'var(--kallo-chart-protein)',
  carbohydrate: 'var(--kallo-chart-carbs)',
  fat: 'var(--kallo-chart-fat)',
};

/**
 * One food per macro instead of an abstract colour swatch — beef, wheat, and a
 * drop of oil for fat, which has no single ingredient the way the other two do.
 * Same three on both platforms (keep in sync).
 */
export const COMPOSITION_ICONS: Record<CompositionKey, LucideIcon> = {
  protein: Beef,
  carbohydrate: Wheat,
  fat: Droplet,
};

export interface CompositionSegment {
  key: CompositionKey;
  /** Share of the total, 0–100. */
  pct: number;
}

export interface Composition {
  totalKcal: number;
  segments: CompositionSegment[];
}

/** Splits already-computed per-macro calories into percentage segments. */
export function compositionFromKcal(
  kcalByKey: Record<CompositionKey, number>
): Composition {
  const totalKcal = COMPOSITION_KEYS.reduce(
    (sum, key) => sum + (kcalByKey[key] || 0),
    0
  );

  return {
    totalKcal,
    segments: COMPOSITION_KEYS.map((key) => ({
      key,
      pct: totalKcal > 0 ? ((kcalByKey[key] || 0) / totalKcal) * 100 : 0,
    })),
  };
}

/**
 * Composition for one meal's (or one day's) macro grams.
 *
 * The split is by CALORIE share, not gram weight: fat carries 9 kcal/g, so by
 * weight it reads about half the slice its energy earns. A null macro counts as
 * zero rather than collapsing the bar — a meal missing one figure still shows
 * the two it has.
 */
export function compositionFromGrams(grams: {
  protein: number | null | undefined;
  carbohydrate: number | null | undefined;
  fat: number | null | undefined;
}): Composition {
  return compositionFromKcal({
    protein: (grams.protein ?? 0) * KCAL_PER_GRAM.protein,
    carbohydrate: (grams.carbohydrate ?? 0) * KCAL_PER_GRAM.carbohydrate,
    fat: (grams.fat ?? 0) * KCAL_PER_GRAM.fat,
  });
}
