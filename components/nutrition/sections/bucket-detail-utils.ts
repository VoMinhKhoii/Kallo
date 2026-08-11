import type {
  DaySeriesMetricKey,
  MacroPattern,
  NutrientCardData,
  NutritionDaySeries,
} from '@/lib/nutrition/types';

/** Charted macros, in the order the detail panel lists them. */
const DETAIL_MACROS: DaySeriesMetricKey[] = [
  'calories',
  'protein',
  'carbohydrate',
  'fat',
];

export interface BucketMetric {
  metric: DaySeriesMetricKey;
  labelKey: string;
  unit: string;
  value: number;
  target: number | null;
  /** `ratioOfTarget` as a percentage, or null when the metric has no target. */
  percentOfTarget: number | null;
}

export interface BucketDetail {
  index: number;
  startDate: string;
  endDate: string;
  macros: BucketMetric[];
  nutrients: BucketMetric[];
}

/**
 * Everything the overview already knows about one bucket, pulled out for the
 * tap-a-column detail panel.
 *
 * No refetch: `daySeries` already carries a per-bucket series for the four
 * macros AND the eight default micronutrients, so a day's breakdown is a read
 * of data that shipped with the page. The extended `moreNutrients` set has no
 * per-bucket series, so it is deliberately absent here — a day view shows the
 * headline eight, not a second full grid.
 *
 * Returns null for a bucket with nothing logged, so the caller can ignore taps
 * on an empty column.
 */
export function buildBucketDetail(
  daySeries: NutritionDaySeries,
  index: number
): BucketDetail | null {
  const macroSet = new Set<DaySeriesMetricKey>(DETAIL_MACROS);
  const read = (metrics: DaySeriesMetricKey[] | null): BucketMetric[] => {
    const out: BucketMetric[] = [];
    for (const series of daySeries.series) {
      const inScope = metrics
        ? metrics.includes(series.metric)
        : !macroSet.has(series.metric);
      if (!inScope) continue;
      const bucket = series.buckets[index];
      if (!bucket || bucket.value === null) continue;
      out.push({
        metric: series.metric,
        labelKey: series.labelKey,
        unit: series.unit,
        value: bucket.value,
        target: series.target,
        percentOfTarget:
          bucket.ratioOfTarget === null ? null : bucket.ratioOfTarget * 100,
      });
    }
    return out;
  };

  const anySeries = daySeries.series[0];
  const bounds = anySeries?.buckets[index];
  if (!bounds) return null;

  const macros = read(DETAIL_MACROS);
  const nutrients = read(null);
  if (macros.length === 0 && nutrients.length === 0) return null;

  // Keep the macro order stable regardless of the series order on the wire.
  macros.sort(
    (a, b) => DETAIL_MACROS.indexOf(a.metric) - DETAIL_MACROS.indexOf(b.metric)
  );

  return {
    index,
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    macros,
    nutrients,
  };
}

/**
 * Re-point the macro figures at one bucket, so the calorie hero and the gram
 * legend read that column instead of the whole range. A macro the bucket has no
 * value for drops to 0 rather than carrying the range average forward, which
 * would silently mix two periods in one row.
 */
export function scopeMacrosToBucket(
  macros: MacroPattern[],
  detail: BucketDetail
): MacroPattern[] {
  const byMetric = new Map(detail.macros.map((m) => [m.metric, m]));
  return macros.map((macro) => ({
    ...macro,
    averagePerDay: byMetric.get(macro.key as DaySeriesMetricKey)?.value ?? 0,
    // Consistency is a property of the range, not of one column in it.
    consistencyPct: null,
  }));
}

/**
 * Re-point the nutrient cards at one bucket.
 *
 * Only the eight default micronutrients carry a per-bucket series, so the
 * extended set resolves to null — the card renders "—" rather than showing the
 * range's average under a single day's heading. `confidence`/`displayState`
 * stay as computed for the range: they describe how much of the food data
 * carried this nutrient at all, which does not become a different question for
 * one column.
 */
export function scopeCardsToBucket(
  cards: NutrientCardData[],
  detail: BucketDetail
): NutrientCardData[] {
  const byMetric = new Map(detail.nutrients.map((n) => [n.metric, n]));
  return cards.map((card) => {
    const scoped = byMetric.get(card.nutrient);
    return {
      ...card,
      averagePerDay: scoped?.value ?? null,
      percentOfTarget: scoped?.percentOfTarget ?? null,
      contextMetrics: undefined,
    };
  });
}

/**
 * The panel's heading: a single date for a day bucket, a `start – end` span for
 * a week one. Parsed as local midnight so the label doesn't shift under UTC.
 */
export function formatBucketRange(
  detail: Pick<BucketDetail, 'startDate' | 'endDate'>,
  locale: string
): string {
  return formatDateSpan(detail.startDate, detail.endDate, locale);
}

/**
 * A `start – end` date span carrying the year, e.g. "Aug 5 – Aug 11, 2026" or
 * "5 thg 8 – 11 thg 8, 2026". A single day collapses to one date.
 *
 * Both ends go through the locale's own day/month/year ordering rather than a
 * hand-built "5–11 Aug" pattern, which is English word order and reads wrong in
 * Vietnamese. The Dart twin uses the same shape (keep in sync).
 */
export function formatDateSpan(
  startDate: string,
  endDate: string,
  locale: string
): string {
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return '';
  const withYear = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (startDate === endDate) return withYear.format(start);

  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(end.getTime())) return withYear.format(start);
  const dayMonth = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  });
  // The year is stated once, on the end, unless the span crosses one.
  const startText =
    start.getFullYear() === end.getFullYear()
      ? dayMonth.format(start)
      : withYear.format(start);
  return `${startText} – ${withYear.format(end)}`;
}
