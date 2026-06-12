import type { HeatmapCell, HeatmapRange } from '@/lib/types/dashboard';

// Earn the wider windows by data age, not by viewport size. A brand-new user
// staring at an empty year grid reads as "you have a year of nothing"; stage up
// as their history actually accumulates.
const DAYS_FOR_90D = 30;
const DAYS_FOR_YEAR = 90;

/**
 * The earliest date with any logged calories in the heatmap, or null when the
 * grid is empty. Cells arrive newest-last per column but oldest columns first,
 * so a linear scan for the first logged cell is the first log within the window.
 */
export function firstLoggedDate(cells: HeatmapCell[][]): string | null {
  let earliest: string | null = null;
  for (const column of cells) {
    for (const cell of column) {
      const hasLog = cell.consumedRatio !== null || cell.ratio !== null;
      if (hasLog && (earliest === null || cell.date < earliest)) {
        earliest = cell.date;
      }
    }
  }
  return earliest;
}

/**
 * The widest range a user's history has earned. With no logs yet, or only a few
 * days in, hold at 30d; widen to 90d after a month of history, and to the full
 * year only after ~90 days. The size chooser still caps this for the viewport.
 */
export function chooseDataAgeRange(
  firstLogDate: string | null,
  today: string
): HeatmapRange {
  if (firstLogDate === null) return '30d';
  const start = Date.parse(`${firstLogDate}T00:00:00.000Z`);
  const now = Date.parse(`${today}T00:00:00.000Z`);
  const daysOfHistory = Math.floor((now - start) / 86_400_000);
  if (daysOfHistory >= DAYS_FOR_YEAR) return 'year';
  if (daysOfHistory >= DAYS_FOR_90D) return '90d';
  return '30d';
}

interface ChooseRenderedHeatmapRangeInput {
  preferredRange: HeatmapRange;
  availableWidth: number;
  availableHeight?: number;
  weekCount: Record<HeatmapRange, number>;
}

const YEAR_MIN_CELL = 10;
const RANGE_90_MIN_CELL = 14;
const DAY_LABEL_WIDTH = 18;
const CELL_GAP: Record<HeatmapRange, number> = {
  '30d': 3,
  '90d': 2,
  year: 1,
};
const HEATMAP_VERTICAL_CHROME = 58;

function cellSizeFor(
  width: number,
  columns: number,
  range: HeatmapRange
): number {
  const gap = CELL_GAP[range];
  return Math.floor(
    (width - DAY_LABEL_WIDTH - Math.max(0, columns - 1) * gap) / columns
  );
}

export function chooseRenderedHeatmapRange({
  preferredRange,
  availableWidth,
  availableHeight,
  weekCount,
}: ChooseRenderedHeatmapRangeInput): HeatmapRange {
  if (preferredRange === '30d') return '30d';

  const heightCell =
    typeof availableHeight === 'number'
      ? Math.floor(
          (availableHeight - HEATMAP_VERTICAL_CHROME - 6 * CELL_GAP['90d']) / 7
        )
      : Number.POSITIVE_INFINITY;
  const range90Cell = Math.min(
    cellSizeFor(availableWidth, weekCount['90d'], '90d'),
    heightCell
  );
  if (preferredRange === '90d') {
    return range90Cell >= RANGE_90_MIN_CELL ? '90d' : '30d';
  }

  const yearCell = Math.min(
    cellSizeFor(availableWidth, weekCount.year, 'year'),
    heightCell
  );

  if (yearCell >= YEAR_MIN_CELL) return 'year';
  if (range90Cell >= RANGE_90_MIN_CELL) return '90d';
  return '30d';
}
