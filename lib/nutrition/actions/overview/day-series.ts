import { DEFAULT_NUTRIENTS, getNutrientMeta } from '../../catalog/nutrients';
import type { MicronutrientTarget } from '../../catalog/reference-targets';
import type {
  DaySeriesBucket,
  DaySeriesBucketUnit,
  DaySeriesMetricKey,
  NutrientDaySeries,
  NutritionDaySeries,
  NutritionNutrientKey,
  NutritionOverview,
  NutritionRange,
} from '../../types';
import type { OverviewMealItemRow } from './query';
import {
  type NumericRowKey,
  type NutritionProfile,
  nullableNumber,
} from './row-metrics';

// Day-series bucket granularity per resolved range: short ranges bucket by day,
// long ranges by week. Table-driven so a new range needs no conditional edits.
//
// 30d and 90d bucket by WEEK because logging is sparse — a month of daily
// columns is mostly holes for anyone who logs 10 days in 30, and 30 columns at
// phone width leaves each one 6px wide. Weekly columns stay populated and
// legible.
export const RANGE_BUCKET_UNIT: Record<NutritionRange, DaySeriesBucketUnit> = {
  '1d': 'day',
  '7d': 'day',
  '30d': 'week',
  '90d': 'week',
};

// Metrics charted on the per-day time axis: the four targeted macros followed
// by the default micronutrients. Each entry knows the row column it sums and
// the macro target (micros resolve their target from `targets` at build time).
const DAY_SERIES_MACROS: {
  metric: DaySeriesMetricKey;
  rowKey: NumericRowKey;
  labelKey: string;
  unit: string;
  target: (profile: NutritionProfile) => number | null;
}[] = [
  {
    metric: 'calories',
    rowKey: 'calories',
    labelKey: 'nutrition.macros.calories',
    unit: 'kcal',
    target: (p) => nullableNumber(p.calorieTarget),
  },
  {
    metric: 'protein',
    rowKey: 'proteinG',
    labelKey: 'nutrition.macros.protein',
    unit: 'g',
    target: (p) => nullableNumber(p.proteinTargetG),
  },
  {
    metric: 'carbohydrate',
    rowKey: 'carbohydrateG',
    labelKey: 'nutrition.macros.carbohydrate',
    unit: 'g',
    target: (p) => nullableNumber(p.carbsTargetG),
  },
  {
    metric: 'fat',
    rowKey: 'fatG',
    labelKey: 'nutrition.macros.fat',
    unit: 'g',
    target: (p) => nullableNumber(p.fatTargetG),
  },
];

function addDays(date: string, days: number): string {
  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  return new Date(parsed + days * 86_400_000).toISOString().slice(0, 10);
}

function diffDays(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00.000Z`);
  const b = Date.parse(`${end}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Walk the period start→end in `step`-day windows. Day buckets use step 1;
 * week buckets use step 7. The final bucket clamps to the period end so a
 * 90-day window doesn't emit a partial trailing week past `endDate`.
 */
function buildBucketBounds(
  startDate: string,
  endDate: string,
  step: number
): { startDate: string; endDate: string }[] {
  const bounds: { startDate: string; endDate: string }[] = [];
  const totalDays = diffDays(startDate, endDate);
  for (let offset = 0; offset <= totalDays; offset += step) {
    const bucketStart = addDays(startDate, offset);
    const bucketEnd = addDays(
      startDate,
      Math.min(offset + step - 1, totalDays)
    );
    bounds.push({ startDate: bucketStart, endDate: bucketEnd });
  }
  return bounds;
}

interface DaySeriesMetricSpec {
  metric: DaySeriesMetricKey;
  rowKey: NumericRowKey;
  labelKey: string;
  unit: string;
  target: number | null;
}

/** Build one metric's bucket series: each bucket's value is the per-day average
 *  of the metric over that bucket's in-scope days, `null` where the bucket holds
 *  none. Pure over its inputs so the day-series builder stays a flat map over
 *  the metric specs. */
function buildMetricSeries(
  spec: DaySeriesMetricSpec,
  bounds: { startDate: string; endDate: string }[],
  daysInBucket: number[],
  seriesRows: OverviewMealItemRow[]
): NutrientDaySeries {
  const buckets: DaySeriesBucket[] = bounds.map((bucket, index) => {
    const days = daysInBucket[index];
    if (days === 0) {
      return {
        startDate: bucket.startDate,
        endDate: bucket.endDate,
        value: null,
        ratioOfTarget: null,
      };
    }
    const total = seriesRows.reduce((sum, row) => {
      if (row.localDate < bucket.startDate || row.localDate > bucket.endDate) {
        return sum;
      }
      return sum + Math.max(0, row[spec.rowKey] ?? 0);
    }, 0);
    const value = total / days;
    return {
      startDate: bucket.startDate,
      endDate: bucket.endDate,
      value,
      ratioOfTarget:
        spec.target && spec.target > 0 ? value / spec.target : null,
    };
  });

  const values = buckets
    .map((bucket) => bucket.value)
    .filter((value): value is number => value !== null);

  return {
    metric: spec.metric,
    labelKey: spec.labelKey,
    unit: spec.unit,
    target: spec.target,
    buckets,
    min: values.length > 0 ? Math.min(...values) : null,
    max: values.length > 0 ? Math.max(...values) : null,
  };
}

/**
 * Build the per-bucket time series: each bucket's value is the per-day average
 * of the metric over that bucket's IN-SCOPE days.
 *
 * Scoped by the same day set as the headline average, the gram legend and the
 * nutrient grid — one card must not average two different day sets. A chart
 * over every logged day under a headline over complete days puts the number
 * above every bar on an under-logged month, which reads as broken however it is
 * justified.
 *
 * What that costs, and why it is the right cost: on a DAY axis (7d) a complete
 * day is `total / 1` under either scope, so its column never moves — flipping
 * the toggle only adds or removes the partial days' columns, which is the whole
 * point of the control. On a WEEK axis (30d/90d) a week's height does move,
 * because its day set changed — but the headline moves with it, so the card
 * stays internally consistent.
 */
export function buildDaySeries({
  scopedRows,
  scopedDates,
  resolvedRange,
  period,
  profile,
  targets,
}: {
  /** Rows on `scopedDates` only — the numerator, matching the divisor below. */
  scopedRows: OverviewMealItemRow[];
  /** The day set the caller's scope averages over. */
  scopedDates: Set<string>;
  resolvedRange: NutritionOverview['resolvedRange'];
  period: { startDate: string; endDate: string };
  profile: NutritionProfile;
  targets: Record<NutritionNutrientKey, MicronutrientTarget>;
}): NutritionDaySeries {
  const unit: DaySeriesBucketUnit = RANGE_BUCKET_UNIT[resolvedRange];
  const step = unit === 'day' ? 1 : 7;
  const bounds = buildBucketBounds(period.startDate, period.endDate, step);

  // Count in-scope days per bucket once; reused for every metric's divisor.
  const scopedDaysInBucket = bounds.map((bucket) => {
    let count = 0;
    for (const date of scopedDates) {
      if (date >= bucket.startDate && date <= bucket.endDate) {
        count += 1;
      }
    }
    return count;
  });

  const metrics: DaySeriesMetricSpec[] = [
    ...DAY_SERIES_MACROS.map((macro) => ({
      metric: macro.metric,
      rowKey: macro.rowKey,
      labelKey: macro.labelKey,
      unit: macro.unit,
      target: macro.target(profile),
    })),
    ...DEFAULT_NUTRIENTS.map((nutrient) => {
      const meta = getNutrientMeta(nutrient);
      return {
        metric: nutrient as DaySeriesMetricKey,
        rowKey: nutrient as NumericRowKey,
        labelKey: meta.labelKey,
        unit: meta.unit,
        target: targets[nutrient].value,
      };
    }),
  ];

  const series: NutrientDaySeries[] = metrics.map((spec) =>
    buildMetricSeries(spec, bounds, scopedDaysInBucket, scopedRows)
  );

  return { unit, series };
}
