import type { userProfiles } from '@/lib/infra/db/schema';
import type { OverviewMealItemRow } from './query';

export type NutritionProfile = typeof userProfiles.$inferSelect;
export type NumericRowKey = {
  [K in keyof OverviewMealItemRow]: OverviewMealItemRow[K] extends number | null
    ? K
    : never;
}[keyof OverviewMealItemRow];

export function sumRows(
  rows: OverviewMealItemRow[],
  key: NumericRowKey
): number {
  return rows.reduce((sum, row) => sum + Math.max(0, row[key] ?? 0), 0);
}

export function groupDailyValues(
  rows: OverviewMealItemRow[],
  key: NumericRowKey
): number[] {
  const dailyValues = new Map<string, number>();

  for (const row of rows) {
    if (row.calories <= 0) {
      continue;
    }

    dailyValues.set(
      row.localDate,
      (dailyValues.get(row.localDate) ?? 0) + (row[key] ?? 0)
    );
  }

  return [...dailyValues.values()];
}

export function nullableNumber(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}
