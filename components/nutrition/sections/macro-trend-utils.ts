import type {
  DaySeriesBucketUnit,
  MacroKey,
  NutritionDaySeries,
} from '@/lib/nutrition/types';

export const KCAL_PER_GRAM = { protein: 4, carbohydrate: 4, fat: 9 } as const;

export const COMPOSITION_KEYS = ['protein', 'carbohydrate', 'fat'] as const;
export type CompositionKey = (typeof COMPOSITION_KEYS)[number];

// The nutrition page's own, brighter pigments — NOT the --nham-macro-* trio the
// dashboard dock and logging feed use. Berry rose / apricot / sage separate by
// hue, so a stacked column still reads at the 6px width the 30-day axis needs.
export const COMPOSITION_COLORS: Record<CompositionKey, string> = {
  protein: 'var(--nham-chart-protein)',
  carbohydrate: 'var(--nham-chart-carbs)',
  fat: 'var(--nham-chart-fat)',
};

export const COMPOSITION_SHORT: Record<CompositionKey, string> = {
  protein: 'P',
  carbohydrate: 'C',
  fat: 'F',
};

export interface MacroTrendPoint {
  index: number;
  startDate: string;
  /** Same as `startDate` for day buckets; the week's last day for week ones. */
  endDate: string;
  /** Null on every macro = the bucket has no in-scope days. Renders as a gap. */
  protein: number | null;
  carbohydrate: number | null;
  fat: number | null;
}

/** Today as a local `YYYY-MM-DD`, matching the server's local-date bucketing. */
export function localIsoDate(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Index of the bucket holding `today`, or -1. Day buckets match exactly; week
 * buckets match the week it falls in, so the current week reads as current.
 */
export function findTodayIndex(
  points: MacroTrendPoint[],
  today: string
): number {
  return points.findIndex(
    (point) => today >= point.startDate && today <= point.endDate
  );
}

/**
 * Turn the overview `daySeries` into stacked macro-calorie bars: one point per
 * bucket, with each macro's kcal (g × 4/4/9). Null when there's no trend to
 * chart — fewer than two buckets or no calories — so the caller keeps the
 * composition bar. Mirrors the Flutter `MacroTrendChart` build.
 */
export function buildMacroTrendData(
  daySeries: NutritionDaySeries
): { points: MacroTrendPoint[]; maxY: number } | null {
  const seriesFor = (metric: MacroKey) =>
    daySeries.series.find((s) => s.metric === metric);

  const protein = seriesFor('protein');
  const carbohydrate = seriesFor('carbohydrate');
  const fat = seriesFor('fat');

  // All macros share the same bucket axis; fall back to whichever exists.
  const buckets = (protein ?? carbohydrate ?? fat)?.buckets ?? [];
  if (buckets.length < 2) return null;

  const raw = (series: typeof protein, i: number) =>
    series && i < series.buckets.length ? series.buckets[i].value : null;

  let maxY = 0;
  const points = buckets.map((bucket, i) => {
    const rp = raw(protein, i);
    const rc = raw(carbohydrate, i);
    const rf = raw(fat, i);

    // Null on all three = the bucket held no in-scope days, because the day was
    // set aside as partial under the "complete days" scope. That is "no data",
    // not "ate nothing" — carry the nulls through so recharts leaves the slot
    // empty instead of drawing a flat zero column that reads as a real datum.
    if (rp === null && rc === null && rf === null) {
      return {
        index: i,
        startDate: bucket.startDate,
        endDate: bucket.endDate,
        protein: null,
        carbohydrate: null,
        fat: null,
      };
    }

    // A null on only SOME macros inside a bucket that does have days is a
    // genuine zero for that macro (mobile `g()` parity).
    const p = (rp ?? 0) * KCAL_PER_GRAM.protein;
    const c = (rc ?? 0) * KCAL_PER_GRAM.carbohydrate;
    const f = (rf ?? 0) * KCAL_PER_GRAM.fat;
    const total = p + c + f;
    if (total > maxY) maxY = total;
    return {
      index: i,
      startDate: bucket.startDate,
      endDate: bucket.endDate,
      protein: p,
      carbohydrate: c,
      fat: f,
    };
  });

  if (maxY <= 0) return null;
  return { points, maxY };
}

/**
 * A round kcal gridline step giving ~3–6 lines across the data range, plus the
 * derived axis top and tick set.
 *
 * Scales to the data. A fixed 3000 kcal ceiling used to keep the axis identical
 * across ranges, but a month averaging 1400 then drew every bar inside the
 * bottom third under half a chart of empty grid — comparability across ranges
 * nobody was making, paid for in the resolution of the one chart on screen.
 */
export function buildMacroTrendAxis(maxY: number): {
  step: number;
  maxLabel: number;
  topY: number;
  ticks: number[];
} {
  const axisTarget = Math.max(maxY, 1);
  // First step that keeps the gridlines under seven. 100 floors the scale so a
  // near-empty chart doesn't label in tens.
  const steps = [100, 250, 500, 1000, 2000];
  const step = steps.find((s) => axisTarget / s <= 6) ?? 2500;
  const maxLabel = Math.ceil(axisTarget / step) * step;
  const topY = maxLabel + step * 0.35; // headroom so the top label isn't clipped

  const ticks: number[] = [];
  for (let v = step; v <= maxLabel; v += step) ticks.push(v);

  return { step, maxLabel, topY, ticks };
}

/**
 * Day buckets → localized weekday initial; week buckets → `d/M` of the week
 * start. Parse as local midnight so the label doesn't shift a day under UTC.
 */
export function formatBucketLabel(
  startDate: string,
  unit: DaySeriesBucketUnit,
  locale: string
): string {
  const d = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  if (unit === 'week') return `${d.getDate()}/${d.getMonth() + 1}`;
  // Vietnamese convention: weekday number for Mon–Sat, "CN" for Sunday. Taking
  // the first grapheme of vi short weekdays ("Th 2".."Th 7"/"CN") yields six
  // indistinct "T"s, so use the numeric scheme instead (matches the mobile chart).
  if (locale.startsWith('vi')) {
    return d.getDay() === 0 ? 'CN' : String(d.getDay() + 1);
  }
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(
    d
  );
  return Array.from(weekday)[0] ?? '';
}

/** How many `d/M` week labels fit before they start colliding on a phone. */
const DENSE_WEEK_AXIS = 8;

/**
 * One tick label per bucket, `''` where the axis should stay bare. 7d (7 day
 * columns) and 30d (5 week columns) label every column. 90d is 13 week columns,
 * where 13 `d/M` labels collide — so it falls back to a month name at the first
 * column and at every crossing into a new month, reading "Jun · Jul · Aug".
 */
export function buildBucketTickLabels(
  points: MacroTrendPoint[],
  unit: DaySeriesBucketUnit,
  locale: string
): string[] {
  if (unit !== 'week' || points.length <= DENSE_WEEK_AXIS) {
    return points.map((point) =>
      formatBucketLabel(point.startDate, unit, locale)
    );
  }

  const month = new Intl.DateTimeFormat(locale, { month: 'short' });
  let previousMonth: number | null = null;
  return points.map((point) => {
    const d = new Date(`${point.startDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    const current = d.getMonth();
    if (previousMonth === current) return '';
    previousMonth = current;
    return month.format(d);
  });
}
