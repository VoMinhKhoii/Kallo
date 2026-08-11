import { classifyDayCompleteness } from '../../pattern/completeness';
import type { CalorieAverages } from '../../types';
import type { DailyCalorieTotal } from './query';

/**
 * Both day scopes' calorie averages for one window.
 *
 * Takes per-day totals rather than meal-item rows: calories per local date is
 * the whole input this needs, so the previous-window read can be a SQL
 * aggregate instead of every item with its twenty-odd nutrient columns.
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
  dayTotals: DailyCalorieTotal[],
  calorieTarget: number | null
): CalorieAverages {
  const loggedDays = dayTotals.filter((day) => day.calories > 0);
  const strict = classifyDayCompleteness(loggedDays, calorieTarget, {
    safetyValve: false,
  });

  const sum = (days: DailyCalorieTotal[]) =>
    days.reduce((total, day) => total + day.calories, 0);
  const completeTotal = sum(
    loggedDays.filter((day) => strict.completeDates.has(day.date))
  );

  return {
    all: {
      averagePerDay:
        loggedDays.length > 0 ? sum(loggedDays) / loggedDays.length : null,
      days: loggedDays.length,
    },
    complete: {
      averagePerDay:
        strict.completeDays > 0 ? completeTotal / strict.completeDays : null,
      days: strict.completeDays,
    },
  };
}
