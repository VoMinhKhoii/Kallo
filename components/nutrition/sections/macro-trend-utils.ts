import type {
  DaySeriesBucketUnit,
  MacroKey,
  NutritionDaySeries,
} from '@/lib/nutrition/types';

export const KCAL_PER_GRAM = { protein: 4, carbohydrate: 4, fat: 9 } as const;

export const COMPOSITION_KEYS = ['protein', 'carbohydrate', 'fat'] as const;
export type CompositionKey = (typeof COMPOSITION_KEYS)[number];

export const COMPOSITION_COLORS: Record<CompositionKey, string> = {
  protein: 'var(--nham-macro-protein)',
  carbohydrate: 'var(--nham-macro-carbs)',
  fat: 'var(--nham-macro-fat)',
};

export const COMPOSITION_SHORT: Record<CompositionKey, string> = {
  protein: 'P',
  carbohydrate: 'C',
  fat: 'F',
};

export interface MacroTrendPoint {
  index: number;
  startDate: string;
  protein: number;
  carbohydrate: number;
  fat: number;
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

  // Null bucket values coerce to 0 (mobile `g()` parity).
  const g = (series: typeof protein, i: number) =>
    (series && i < series.buckets.length ? series.buckets[i].value : null) ?? 0;

  let maxY = 0;
  const points = buckets.map((bucket, i) => {
    const p = g(protein, i) * KCAL_PER_GRAM.protein;
    const c = g(carbohydrate, i) * KCAL_PER_GRAM.carbohydrate;
    const f = g(fat, i) * KCAL_PER_GRAM.fat;
    const total = p + c + f;
    if (total > maxY) maxY = total;
    return {
      index: i,
      startDate: bucket.startDate,
      protein: p,
      carbohydrate: c,
      fat: f,
    };
  });

  if (maxY <= 0) return null;
  return { points, maxY };
}

/**
 * A round kcal gridline step giving ~3–5 lines across the data range, plus the
 * derived axis top and tick set. The axis always reaches at least 3000 kcal so
 * the 2500 / 3000 guides show, and grows past that if intake exceeds it.
 */
export function buildMacroTrendAxis(maxY: number): {
  step: number;
  maxLabel: number;
  topY: number;
  ticks: number[];
} {
  const axisTarget = Math.max(maxY, 3000);
  // <= 6 so a ~3000 axis keeps a 500 step (shows 2500 and 3000), not 1000.
  const steps = [250, 500, 1000, 1500, 2000];
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
