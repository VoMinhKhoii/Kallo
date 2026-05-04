import type {
  HeatmapCell,
  HeatmapData,
  HeatmapMonthHeader,
  HeatmapRange,
} from '@/lib/types/dashboard';

export type DashboardTimeRange = HeatmapRange;

export interface DailyCalories {
  date: string;
  calories: number;
}

interface BuildCalorieAdherenceHeatmapInput {
  range: DashboardTimeRange;
  dailyCalories: DailyCalories[];
  calorieTarget: number | null;
  timezoneOffset: number;
  now?: Date;
}

const RANGE_DAYS: Record<Exclude<DashboardTimeRange, 'year'>, number> = {
  '30d': 30,
  '90d': 90,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateKeyToUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

function startOfMondayWeek(date: Date): Date {
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addDays(date, diffToMonday);
}

function getMondayDayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

function startOfLocalYear(endKey: string): Date {
  return new Date(Date.UTC(Number(endKey.slice(0, 4)), 0, 1));
}

function endOfLocalYear(endKey: string): Date {
  return new Date(Date.UTC(Number(endKey.slice(0, 4)), 11, 31));
}

function getRangeBounds(
  range: DashboardTimeRange,
  endDate: Date,
  endKey: string
): { startDate: Date; rangeEndDate: Date } {
  if (range === 'year') {
    return {
      startDate: startOfLocalYear(endKey),
      rangeEndDate: endOfLocalYear(endKey),
    };
  }

  return {
    startDate: addDays(endDate, -(RANGE_DAYS[range] - 1)),
    rangeEndDate: endDate,
  };
}

function buildMonthHeaders(
  startWeek: Date,
  endWeek: Date,
  rangeStart: Date,
  rangeEnd: Date
): HeatmapMonthHeader[] {
  const headers = new Map<string, HeatmapMonthHeader>();

  for (
    let current = startWeek;
    current.getTime() <= addDays(endWeek, 6).getTime();
    current = addDays(current, 1)
  ) {
    if (
      current.getTime() < rangeStart.getTime() ||
      current.getTime() > rangeEnd.getTime()
    ) {
      continue;
    }

    const month = current.toLocaleString('en-US', {
      month: 'short',
      timeZone: 'UTC',
    });
    const column = Math.floor(daysBetween(startWeek, current) / 7);
    const existing = headers.get(month);

    if (!existing) {
      headers.set(month, { month, startColumn: column, span: 1 });
      continue;
    }

    existing.span = column - existing.startColumn + 1;
  }

  return Array.from(headers.values());
}

export function getLocalDateKey(date: Date, timezoneOffset: number): string {
  const localDate = new Date(date.getTime() - timezoneOffset * 60 * 1000);
  return toDateKey(localDate);
}

export function buildCalorieAdherenceHeatmapData({
  range,
  dailyCalories,
  calorieTarget,
  timezoneOffset,
  now = new Date(),
}: BuildCalorieAdherenceHeatmapInput): HeatmapData {
  const endKey = getLocalDateKey(now, timezoneOffset);
  const endDate = dateKeyToUtcDate(endKey);
  const { startDate, rangeEndDate } = getRangeBounds(range, endDate, endKey);
  const startWeek = startOfMondayWeek(startDate);
  const endWeek = startOfMondayWeek(rangeEndDate);
  const weekCount = Math.floor(daysBetween(startWeek, endWeek) / 7) + 1;

  const cells: HeatmapCell[][] = Array.from({ length: 7 }, (_, dayIndex) =>
    Array.from({ length: weekCount }, (_, weekIndex): HeatmapCell => {
      const date = addDays(startWeek, weekIndex * 7 + dayIndex);
      const dateKey = toDateKey(date);
      const status =
        date.getTime() < startDate.getTime()
          ? 'outside'
          : date.getTime() > endDate.getTime()
            ? 'future'
            : 'unlogged';

      return { date: dateKey, ratio: null, status };
    })
  );

  const caloriesByDate = new Map(
    dailyCalories.map((day) => [day.date, day.calories])
  );
  const hasTarget = calorieTarget !== null && calorieTarget > 0;

  for (
    let current = startDate;
    current.getTime() <= endDate.getTime();
    current = addDays(current, 1)
  ) {
    const key = toDateKey(current);
    const calories = caloriesByDate.get(key);
    if (calories === undefined || !hasTarget) continue;

    const weekIndex = Math.floor(daysBetween(startWeek, current) / 7);
    const dayIndex = getMondayDayIndex(current);
    cells[dayIndex][weekIndex] = {
      date: key,
      ratio: calories / calorieTarget,
      status: 'logged',
    };
  }

  return {
    cells,
    monthHeaders: buildMonthHeaders(
      startWeek,
      endWeek,
      startDate,
      rangeEndDate
    ),
  };
}

/** Returns transposed heatmap data: 7 rows (Mon-Sun) x N week columns. */
export function buildCalorieAdherenceHeatmap(
  input: BuildCalorieAdherenceHeatmapInput
): (number | null)[][] {
  return buildCalorieAdherenceHeatmapData(input).cells.map((row) =>
    row.map((cell) => (cell.status === 'logged' ? cell.ratio : null))
  );
}
