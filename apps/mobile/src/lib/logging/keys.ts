/**
 * React Query keys for the logging surface — replicated EXACTLY from the web
 * (hooks/use-logging-day.ts) so the cache shape and prefix-matching behavior
 * match. The day query uses the 4-element `byUserDateOffset`; invalidations use
 * the 3-element `byUserDate` and rely on TanStack prefix matching — never add
 * `exact: true`.
 */
export const loggingDayKeys = {
  all: ['logging-day'] as const,
  byUserDate: (userId: string, date: string) =>
    ['logging-day', userId, date] as const,
  byUserDateOffset: (userId: string, date: string, timezoneOffset: number) =>
    ['logging-day', userId, date, timezoneOffset] as const,
};

export const mealDatesKey = (userId: string, timezoneOffset: number) =>
  ['meal-dates', userId, timezoneOffset] as const;

/** Local YYYY-MM-DD (matches the web's todayDateString). */
export function todayDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
