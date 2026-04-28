export type DashboardTimeRange = '30d' | '90d';

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

const RANGE_DAYS: Record<DashboardTimeRange, number> = {
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

export function getLocalDateKey(date: Date, timezoneOffset: number): string {
  const localDate = new Date(date.getTime() - timezoneOffset * 60 * 1000);
  return toDateKey(localDate);
}

/** Returns transposed heatmap data: 7 rows (Mon-Sun) x N week columns. */
export function buildCalorieAdherenceHeatmap({
  range,
  dailyCalories,
  calorieTarget,
  timezoneOffset,
  now = new Date(),
}: BuildCalorieAdherenceHeatmapInput): (number | null)[][] {
  const endKey = getLocalDateKey(now, timezoneOffset);
  const endDate = dateKeyToUtcDate(endKey);
  const startDate = addDays(endDate, -(RANGE_DAYS[range] - 1));
  const startWeek = startOfMondayWeek(startDate);
  const endWeek = startOfMondayWeek(endDate);
  const weekCount = Math.floor(daysBetween(startWeek, endWeek) / 7) + 1;

  const heatmap = Array.from({ length: 7 }, () =>
    Array.from<number | null>({ length: weekCount }).fill(null)
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
    heatmap[dayIndex][weekIndex] = calories / calorieTarget;
  }

  return heatmap;
}
