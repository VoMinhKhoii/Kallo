import { classifyDayCompleteness } from '../../pattern/completeness';
import type { CalorieAverages } from '../../types';
import type { OverviewMealItemRow } from './query';
import { sumRows } from './row-metrics';

/**
 * Both day scopes' calorie averages for one window of rows.
 *
 * Extracted so the CURRENT window and the one before it are measured by the
 * same rule — a comparison between two periods scored differently would be
 * worse than no comparison at all.
 *
 * `complete` uses the strict (no safety-valve) classification: a genuinely
 * under-logged window yields zero complete days rather than quietly promoting
 * partial ones.
 */
export function buildCalorieAverages(
  rows: OverviewMealItemRow[],
  calorieTarget: number | null
): CalorieAverages {
  const loggedDates = new Set(
    rows.filter((row) => row.calories > 0).map((row) => row.localDate)
  );
  const loggedDays = loggedDates.size;

  const dayCalories = new Map<string, number>();
  for (const row of rows) {
    if (row.calories <= 0) continue;
    dayCalories.set(
      row.localDate,
      (dayCalories.get(row.localDate) ?? 0) + row.calories
    );
  }
  const strict = classifyDayCompleteness(
    [...dayCalories].map(([date, calories]) => ({ date, calories })),
    calorieTarget,
    { safetyValve: false }
  );

  const loggedRows = rows.filter((row) => loggedDates.has(row.localDate));
  const completeRows = rows.filter((row) =>
    strict.completeDates.has(row.localDate)
  );

  return {
    all: {
      averagePerDay:
        loggedDays > 0 ? sumRows(loggedRows, 'calories') / loggedDays : null,
      days: loggedDays,
    },
    complete: {
      averagePerDay:
        strict.completeDays > 0
          ? sumRows(completeRows, 'calories') / strict.completeDays
          : null,
      days: strict.completeDays,
    },
  };
}
