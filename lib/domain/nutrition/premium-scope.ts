import type { DaySeriesMetricKey, MacroKey, NutritionOverview } from './types';

/**
 * The macro/calorie metrics a non-entitled viewer keeps on the time axis —
 * the same four `bucket-detail.ts` charts as macros. Everything else in
 * `daySeries.series` is a micronutrient and is dropped.
 */
const MACRO_METRICS = new Set<DaySeriesMetricKey>([
  'calories',
  'protein',
  'carbohydrate',
  'fat',
] satisfies MacroKey[]);

/**
 * Remove every micronutrient figure from an overview and flag it as locked.
 *
 * This runs SERVER-SIDE, between building the DTO and returning it, so the
 * data a non-entitled viewer is not paying for never reaches their client at
 * all — the lock is not a client-side rendering choice that a devtools tab
 * could undo. Calories and macros stay: only the micronutrient half of
 * `/nutrition` is premium.
 *
 * Pure: the input overview is not mutated, and the arrays it owns are replaced
 * rather than emptied in place.
 */
export function stripMicronutrients(
  overview: NutritionOverview
): NutritionOverview {
  return {
    ...overview,
    summary: {
      ...overview.summary,
      mostConsistent: [],
      needsAttention: [],
      limitedDataCount: 0,
    },
    daySeries: {
      ...overview.daySeries,
      series: overview.daySeries.series.filter((series) =>
        MACRO_METRICS.has(series.metric)
      ),
    },
    micronutrients: [],
    spotlight: [],
    steady: [],
    moreNutrients: [],
    educationCards: [],
    micronutrientsLocked: true,
  };
}
