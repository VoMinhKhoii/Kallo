import type { TimeRange } from '@/lib/core/types/dashboard';

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` → local midnight. Split by hand so the string is never read as UTC. */
function parseLogDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** `YYYY-MM-DD` plus an offset, as a Date. The constructor handles overflow. */
function addDays(iso: string, days: number): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day + days);
}

/**
 * Calendar-day offsets of each logged date from the first one — the chart's X
 * values. Plotting by offset rather than by array index is what makes a gap in
 * logging read as a gap: three logs on days 0, 11 and 22 sit where they fall,
 * not evenly spaced.
 *
 * Returns array indices when `dates` doesn't line up with the weights (an older
 * server can omit `weightDates`), which reproduces the previous behaviour
 * rather than dropping the chart.
 */
export function toDayOffsets(dates: string[], count: number): number[] {
  const positions = Array.from({ length: count }, (_, i) => i);
  if (dates.length !== count || count === 0) return positions;

  const times = dates.map((iso) => parseLogDate(iso).getTime());
  // All or nothing, and only for a series that actually runs forwards. Falling
  // back per element would mix day offsets with list positions in one array —
  // non-monotonic x, which draws a silently wrong chart rather than a degraded
  // one, and a single unparseable date would poison the domain with NaN.
  // Matches the mobile `weightDayOffsets`.
  const usable =
    times.every(Number.isFinite) &&
    times.every((time, i) => i === 0 || time >= times[i - 1]);
  if (!usable) return positions;

  return times.map((time) => Math.round((time - times[0]) / DAY_MS));
}

/**
 * Up to `desired` evenly spaced ticks across the logged span, with the last one
 * pinned to the newest reading so it always carries the "now" label.
 */
export function buildXTicks(offsets: number[], desired = 4): number[] {
  const last = offsets[offsets.length - 1] ?? 0;
  if (offsets.length < 2 || last <= 0) return [0];

  const step = last / (desired - 1);
  const ticks = Array.from({ length: desired }, (_, i) => Math.round(i * step));
  ticks[ticks.length - 1] = last;
  return ticks.filter((value, i, all) => all.indexOf(value) === i);
}

/**
 * Day offset → axis label. 30d reads as `19/9`, 90d as `19 Sep`; both follow the
 * locale's own field order, and the numeric form on 30d keeps Vietnamese inside
 * the tick budget ("19 thg 9" does not fit).
 */
export function makeDayLabeller(
  dates: string[],
  locale: string,
  range: TimeRange
): (day: number) => string {
  if (dates.length === 0) return () => '';
  // 30d is day/month in that order in EVERY locale, matching the mobile chart:
  // `Intl` would render `en` as "8/28" against mobile's "28/8" for the same
  // reading. A fixed order is also the same width in every language, which is
  // what keeps four ticks inside the plot.
  const monthName =
    range === '30d'
      ? null
      : new Intl.DateTimeFormat(locale, { month: 'short' });
  return (day) => {
    const date = addDays(dates[0], day);
    if (Number.isNaN(date.getTime())) return '';
    return monthName
      ? `${date.getDate()} ${monthName.format(date)}`
      : `${date.getDate()}/${date.getMonth() + 1}`;
  };
}

export interface YAxisBand {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

/**
 * Round-number Y band fitted to `values`: a step that yields a few evenly
 * spaced gridlines, bounds snapped outward to whole steps, then a tick at every
 * step.
 *
 * Buckets on the same round-number steps as the mobile `niceYAxis`, but is
 * deliberately tighter: mobile clips its plot (`FlClipData.all`) and pads the
 * band so the newest dot's 9px halo survives, where recharts draws dots
 * outside the plot area and needs no such headroom.
 *
 * Non-finite input yields the band a lone zero would get. The tick loop below
 * advances by addition, so an infinite bound would never terminate — a hung
 * main thread, not a bad chart.
 */
export function niceYAxis(values: number[]): YAxisBand {
  const finite = values.filter(Number.isFinite);
  const rawMin = finite.length > 0 ? Math.min(...finite) : 0;
  const rawMax = finite.length > 0 ? Math.max(...finite) : 0;
  const span = Math.max(rawMax - rawMin, 0.5);
  const step = span <= 2 ? 0.5 : span <= 5 ? 1 : span <= 12 ? 2 : 5;

  let min = Math.floor(rawMin / step) * step;
  let max = Math.ceil(rawMax / step) * step;
  if (max - min < step * 1.5) {
    min -= step;
    max += step;
  }

  const ticks: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) {
    ticks.push(Number(v.toFixed(2)));
  }
  return { min, max, step, ticks };
}

/**
 * Tick text for a Y band, and the gutter it needs. A half-kilo step prints four
 * characters ("71.0") where a whole-step band prints two, and a gutter sized
 * for the short form clips the long one to "'1.0".
 */
export function yAxisGutter(band: YAxisBand): {
  format: (value: number) => string;
  width: number;
} {
  const format = (value: number) =>
    band.step >= 1 ? value.toFixed(0) : value.toFixed(1);
  return {
    format,
    width: band.ticks.some((value) => format(value).length > 3) ? 36 : 26,
  };
}

export interface ChartPoint {
  /** Calendar days since the first logged reading — not the array index. */
  day: number;
  actual: number | null;
  forecast: number | null;
}

/**
 * A tick names either an end of the axis or a calendar day. Kinds, not strings,
 * so this module stays pure and the component owns the translations.
 */
export type WeightTickKind = 'start' | 'now' | 'date';
export interface WeightTick {
  value: number;
  kind: WeightTickKind;
}

export interface WeightPlot {
  isEmpty: boolean;
  points: ChartPoint[];
  band: YAxisBand;
  xDomain: [number, number];
  ticks: WeightTick[];
  showForecast: boolean;
  lastOffset: number;
}

interface BuildWeightPlotInput {
  weights: number[];
  /** `YYYY-MM-DD`, parallel to `weights`. */
  dates: string[];
  rangeDays: number;
  projectedEndWeight?: number;
  canProject: boolean;
  periodElapsedDays?: number | null;
  /** Centres the band when nothing is logged yet. */
  placeholder: number;
}

/**
 * Everything the chart needs to draw, resolved once: where the readings sit,
 * how far the projection runs, the Y band, the x domain and the ticks.
 *
 * Pure on purpose — the empty, single-reading and missing-dates cases are the
 * ones most likely to regress, and here they can be tested without rendering a
 * chart. The component is then only presentation.
 */
export function buildWeightPlot({
  weights,
  dates,
  rangeDays,
  projectedEndWeight,
  canProject,
  periodElapsedDays,
  placeholder,
}: BuildWeightPlotInput): WeightPlot {
  const isEmpty = weights.length === 0;
  // An older server can omit the dates (see `WeightSummaryData.weightDates`).
  // Then there is nothing to tick but the two ends — a degraded axis rather
  // than a row of blank labels.
  const hasDates = dates.length === weights.length && !isEmpty;
  const offsets = toDayOffsets(dates, weights.length);
  const lastOffset = offsets[offsets.length - 1] ?? 0;

  // `canProject` already implies ≥3 logged readings (see
  // buildWeightTrendSummary), so the server never pairs it with an empty
  // series — but this is a pure function that has to answer for itself, and a
  // projection with nothing to project from is not a projection.
  const showForecast =
    !isEmpty && canProject && typeof projectedEndWeight === 'number';
  const elapsed =
    typeof periodElapsedDays === 'number' && periodElapsedDays > 0
      ? periodElapsedDays
      : lastOffset || 1;
  // Cap the tail so the logged data always spans ≥80% of the width (a short
  // dotted tail) instead of being squashed when the period is early.
  const forecastDay = showForecast
    ? Math.min(
        lastOffset + (lastOffset * (rangeDays - elapsed)) / elapsed,
        lastOffset / 0.8
      )
    : lastOffset;

  const points: ChartPoint[] = weights.map((weight, i) => ({
    day: offsets[i],
    actual: weight,
    forecast: null,
  }));
  if (showForecast && points.length > 0) {
    // Anchor the forecast at the current reading, then extend it forward.
    points[points.length - 1].forecast = weights[weights.length - 1];
    points.push({
      day: forecastDay,
      actual: null,
      forecast: projectedEndWeight as number,
    });
  }

  // An empty chart still draws its frame, banded around the weight we know of,
  // so the card reads as "nothing logged yet" rather than as a component that
  // failed to render.
  const band = niceYAxis(
    isEmpty
      ? [placeholder - 1, placeholder + 1]
      : [...weights, ...(showForecast ? [projectedEndWeight as number] : [])]
  );

  return {
    isEmpty,
    points,
    band,
    // One reading centres: a 0…rangeDays domain pinned the lone dot and its
    // date label against the left edge, with the label's own width hanging
    // outside the plot. Matches the mobile canvas.
    xDomain: isEmpty
      ? [0, rangeDays - 1]
      : weights.length === 1
        ? [-0.5, 0.5]
        : [0, forecastDay],
    ticks: resolveTicks({
      isEmpty,
      hasDates,
      weights,
      offsets,
      rangeDays,
      lastOffset,
    }),
    showForecast,
    lastOffset,
  };
}

function resolveTicks({
  isEmpty,
  hasDates,
  weights,
  offsets,
  rangeDays,
  lastOffset,
}: {
  isEmpty: boolean;
  hasDates: boolean;
  weights: number[];
  offsets: number[];
  rangeDays: number;
  lastOffset: number;
}): WeightTick[] {
  if (isEmpty) {
    return [
      { value: 0, kind: 'start' },
      { value: rangeDays - 1, kind: 'now' },
    ];
  }
  // One reading: that day IS the axis, so it gets the only tick, labelled with
  // its own date — "Start" named a range the chart does not have. A second
  // "Now" tick at the far edge would name a day nothing was logged on.
  if (weights.length === 1) {
    return [{ value: 0, kind: hasDates ? 'date' : 'now' }];
  }
  if (!hasDates) {
    return [
      { value: 0, kind: 'start' },
      { value: lastOffset, kind: 'now' },
    ];
  }
  return buildXTicks(offsets).map((value) => ({
    value,
    kind: value === lastOffset ? 'now' : 'date',
  }));
}
