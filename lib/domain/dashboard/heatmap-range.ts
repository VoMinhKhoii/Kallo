import { dayKeyToUtcDate, mondayIndex } from '@/lib/core/date/day-key';
import type { HeatmapRange } from '@/lib/core/types/dashboard';
import { MAX_HEATMAP_DAYS } from '@/lib/core/validation/dashboard';

interface ChooseRenderedHeatmapRangeInput {
  preferredRange: HeatmapRange;
  availableWidth: number;
  availableHeight?: number;
  /** Today's local day key: a fitted span ends today and starts on a Monday. */
  todayDate: string;
}

const YEAR_MIN_CELL = 10;
const RANGE_90_MIN_CELL = 14;
const DAY_LABEL_WIDTH = 18;
const YEAR_GAP = 1;
const DAYS_GAP = 2;
const MONTH_GAP = 3;
const HEATMAP_VERTICAL_CHROME = 58;
// Below year width, a card with room for more than 90 days shows more recent
// weeks at the square a phone shows (~20px), instead of growing 14 columns
// until they hit their cap and leave the rest of the card empty.
const FIT_CELL = 20;
const RANGE_90_WEEKS = 14;

/** A month's 5 columns breathe; longer spans pack tighter; a year tightest. */
export function heatmapGap(range: HeatmapRange): number {
  if (range === 'year') return YEAR_GAP;
  return range === '30d' ? MONTH_GAP : DAYS_GAP;
}

/**
 * Ceiling per range so a wide card can't inflate sparse grids (a 5-column 30d
 * grid at full width would be comically tall). The year grid never hits its
 * cap inside the 1440px-capped dashboard, so it always spans the card.
 */
export function heatmapMaxSquare(range: HeatmapRange): number {
  if (range === 'year') return 28;
  return range === '30d' ? 32 : 24;
}

/** Days in a trailing range ('90d' → 90); null for the calendar year. */
export function heatmapRangeDays(range: HeatmapRange): number | null {
  return range === 'year' ? null : Number.parseInt(range, 10);
}

/** Week columns a range draws — what the skeleton holds before data. */
export function heatmapWeekCount(range: HeatmapRange): number {
  const days = heatmapRangeDays(range);
  if (days === null) return 53;
  // 90 days rarely starts on a Monday, so it usually spills into a 14th
  // column; a fitted span starts on one and fills its weeks exactly.
  if (range === '90d') return RANGE_90_WEEKS;
  return Math.ceil(days / 7);
}

function cellSizeFor(width: number, columns: number, gap: number): number {
  return Math.floor(
    (width - DAY_LABEL_WIDTH - Math.max(0, columns - 1) * gap) / columns
  );
}

/**
 * The most recent whole weeks that fit at [FIT_CELL], ending today. Ninety
 * days when no more than its 14 weeks fit, so a phone keeps the range the
 * iOS app shows. A longer span starts on a Monday, so its first column is
 * never half empty.
 */
function fittedRange(width: number, todayDate: string): HeatmapRange {
  const weeks = Math.min(
    Math.floor((width - DAY_LABEL_WIDTH + DAYS_GAP) / (FIT_CELL + DAYS_GAP)),
    Math.floor(MAX_HEATMAP_DAYS / 7)
  );
  if (weeks <= RANGE_90_WEEKS) return '90d';
  const todayIndex = mondayIndex(dayKeyToUtcDate(todayDate));
  return `${(weeks - 1) * 7 + todayIndex + 1}d`;
}

export function chooseRenderedHeatmapRange({
  preferredRange,
  availableWidth,
  availableHeight,
  todayDate,
}: ChooseRenderedHeatmapRangeInput): HeatmapRange {
  if (preferredRange === '30d') return '30d';

  const heightCell =
    typeof availableHeight === 'number'
      ? Math.floor(
          (availableHeight - HEATMAP_VERTICAL_CHROME - 6 * DAYS_GAP) / 7
        )
      : Number.POSITIVE_INFINITY;
  const range90Cell = Math.min(
    cellSizeFor(availableWidth, RANGE_90_WEEKS, DAYS_GAP),
    heightCell
  );
  if (preferredRange !== 'year') {
    return range90Cell >= RANGE_90_MIN_CELL ? '90d' : '30d';
  }

  const yearCell = Math.min(
    cellSizeFor(availableWidth, 53, YEAR_GAP),
    heightCell
  );

  if (yearCell >= YEAR_MIN_CELL) return 'year';
  if (range90Cell >= RANGE_90_MIN_CELL) {
    return fittedRange(availableWidth, todayDate);
  }
  return '30d';
}
