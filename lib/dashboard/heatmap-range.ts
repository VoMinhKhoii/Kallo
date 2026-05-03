import type { HeatmapRange } from '@/components/dashboard/types';

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

  const yearCell = cellSizeFor(availableWidth, weekCount.year, 'year');

  if (yearCell >= YEAR_MIN_CELL) return 'year';
  if (range90Cell >= RANGE_90_MIN_CELL) return '90d';
  return '30d';
}
