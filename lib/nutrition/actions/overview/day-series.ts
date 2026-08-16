import { dayKeyToUtcDate, toUtcDayKey } from '@/lib/date/day-key';
import { MS_PER_DAY } from '@/lib/date/ms';
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
  return toUtcDayKey(dayKeyToUtcDate(date).getTime() + days * MS_PER_DAY);
}

function diffDays(start: string, end: string): number {
  const a = dayKeyToUtcDate(start).getTime();
  const b = dayKeyToUtcDate(end).getTime();
  return Math.round((b - a) / MS_PER_DAY);
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

/** One bucket's bounds and its two day counts: the days the caller's scope
 *  averages over, and every logged day in it. */
interface BucketWindow {
  startDate: string;
  endDate: string;
  scopedDays: number;
  loggedDays: number;
}

/** Build one metric's bucket series. Every bucket averages over its LOGGED
 *  days, whatever the scope; a bucket the scope has no day in is flagged
 *  `excluded` so the column greys. `null` only where nothing was logged at all.
 *  Pure over its inputs so the day-series builder stays a flat map over the
 *  metric specs. */
function buildMetricSeries(
  spec: DaySeriesMetricSpec,
  windows: BucketWindow[],
  loggedRows: OverviewMealItemRow[]
): NutrientDaySeries {
  const buckets: DaySeriesBucket[] = windows.map((window) => {
    if (window.loggedDays === 0) {
      return {
        startDate: window.startDate,
        endDate: window.endDate,
        value: null,
        ratioOfTarget: null,
        excluded: false,
      };
    }
    const total = loggedRows.reduce((sum, row) => {
      if (row.localDate < window.startDate || row.localDate > window.endDate) {
        return sum;
      }
      return sum + Math.max(0, row[spec.rowKey] ?? 0);
    }, 0);
    const value = total / window.loggedDays;
    return {
      startDate: window.startDate,
      endDate: window.endDate,
      value,
      ratioOfTarget:
        spec.target && spec.target > 0 ? value / spec.target : null,
      excluded: window.scopedDays === 0,
    };
  });

  // Excluded buckets are shown but not counted — the band describes the spread
  // of what the headline actually averages.
  const values = buckets
    .filter((bucket) => !bucket.excluded)
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
 * of the metric over that bucket's LOGGED days, in every scope, plus a flag for
 * whether the current scope counts the bucket at all.
 *
 * The heights are deliberately scope-independent. The day scope changes what is
 * AVERAGED, not what was eaten, so flipping it must not move a bar — a column
 * that jumps on a toggle reads as the data being unstable, and this chart's job
 * is to be the fixed thing the headline is measured against. What the toggle
 * does instead is grey: `excluded` marks the buckets the scope leaves out, so
 * you can see what it set aside rather than watching numbers rearrange.
 *
 * The trade this makes: on a WEEK axis a bucket mixing complete and partial
 * days stays coloured and keeps averaging all of them, so it can sit a little
 * under the complete-days headline above it. Exactness there would cost the
 * stable heights, which is the worse trade. On a DAY axis there is no mixing at
 * all — one column is one day, coloured or grey, exact either way.
 */
export function buildDaySeries({
  scopedDates,
  loggedRows,
  loggedDates,
  resolvedRange,
  period,
  profile,
  targets,
}: {
  /** The day set the caller's scope averages over — decides greying only. */
  scopedDates: Set<string>;
  /** Rows on every logged day. The numerator for every bucket. */
  loggedRows: OverviewMealItemRow[];
  /** Every day with calories, in scope or not. The divisor. */
  loggedDates: Set<string>;
  resolvedRange: NutritionOverview['resolvedRange'];
  period: { startDate: string; endDate: string };
  profile: NutritionProfile;
  targets: Record<NutritionNutrientKey, MicronutrientTarget>;
}): NutritionDaySeries {
  const unit: DaySeriesBucketUnit = RANGE_BUCKET_UNIT[resolvedRange];
  const step = unit === 'day' ? 1 : 7;

  // Count both day sets per bucket once; reused for every metric's divisor.
  const countIn = (dates: Set<string>, start: string, end: string) => {
    let count = 0;
    for (const date of dates) {
      if (date >= start && date <= end) count += 1;
    }
    return count;
  };
  const windows: BucketWindow[] = buildBucketBounds(
    period.startDate,
    period.endDate,
    step
  ).map((bucket) => ({
    startDate: bucket.startDate,
    endDate: bucket.endDate,
    scopedDays: countIn(scopedDates, bucket.startDate, bucket.endDate),
    loggedDays: countIn(loggedDates, bucket.startDate, bucket.endDate),
  }));

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
    buildMetricSeries(spec, windows, loggedRows)
  );

  return { unit, series };
}
