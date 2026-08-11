import type {
  DaySeriesMetricKey,
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
 * The panel's heading: a single date for a day bucket, a `start – end` span for
 * a week one. Parsed as local midnight so the label doesn't shift under UTC.
 */
export function formatBucketRange(
  detail: Pick<BucketDetail, 'startDate' | 'endDate'>,
  locale: string
): string {
  const format = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  });
  const start = new Date(`${detail.startDate}T00:00:00`);
  if (detail.startDate === detail.endDate) {
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(
      start
    );
    return `${weekday}, ${format.format(start)}`;
  }
  const end = new Date(`${detail.endDate}T00:00:00`);
  return `${format.format(start)} – ${format.format(end)}`;
}
