/**
 * Day-completeness classification for long-span nutrition metrics.
 *
 * A day where the user logged only one or two meals and then forgot drags
 * averages down and registers as a consistency "miss" even though it does not
 * reflect what they actually ate. Long-span metrics therefore compute over
 * "complete" days only and surface "partial" days separately.
 */

/** Calories below this fraction of the completeness baseline mark a partial day. */
export const PARTIAL_DAY_FRACTION = 0.5;

export interface DayCompleteness {
  completeDates: Set<string>;
  partialDates: Set<string>;
  completeDays: number;
  partialDays: number;
}

export function medianOf(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Classifies logged days (calories > 0) into complete vs partial.
 *
 * A logged day is "partial" when its total calories fall below
 * `PARTIAL_DAY_FRACTION` of the completeness baseline:
 *   - `calorieTarget` when set (already goal-adjusted, so genuine low-calorie
 *     cutting days mostly stay above the bar),
 *   - otherwise the median of logged-day calories.
 *
 * Safety valve: if every logged day would be partial (chronic under-logger or
 * no usable baseline), all days are treated as complete so downstream averages
 * never collapse to an empty state.
 *
 * `dayCalories` must already be aggregated to one entry per local date.
 */
export function classifyDayCompleteness(
  dayCalories: { date: string; calories: number }[],
  calorieTarget: number | null
): DayCompleteness {
  const loggedDays = dayCalories.filter((day) => day.calories > 0);

  const allComplete = (): DayCompleteness => ({
    completeDates: new Set(loggedDays.map((day) => day.date)),
    partialDates: new Set<string>(),
    completeDays: loggedDays.length,
    partialDays: 0,
  });

  if (loggedDays.length === 0) {
    return allComplete();
  }

  const baseline =
    calorieTarget !== null && calorieTarget > 0
      ? calorieTarget
      : medianOf(loggedDays.map((day) => day.calories));

  if (baseline <= 0) {
    return allComplete();
  }

  const floor = PARTIAL_DAY_FRACTION * baseline;
  const completeDates = new Set<string>();
  const partialDates = new Set<string>();

  for (const day of loggedDays) {
    if (day.calories < floor) {
      partialDates.add(day.date);
    } else {
      completeDates.add(day.date);
    }
  }

  if (completeDates.size === 0) {
    return allComplete();
  }

  return {
    completeDates,
    partialDates,
    completeDays: completeDates.size,
    partialDays: partialDates.size,
  };
}
