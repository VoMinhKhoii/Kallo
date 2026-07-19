/** Local calendar-day identity for an ISO timestamp. Feed grouping is a
 * viewer-local presentation concern, so it deliberately follows the browser. */
export function threadDayKey(iso: string): string {
  return new Date(iso).toDateString();
}

/** Human label for a thread day without changing the timestamp used by the
 * server cursor. Today/yesterday copy remains localized by the caller. */
export function threadDayLabel(
  iso: string,
  locale: string,
  todayLabel: string,
  yesterdayLabel: string
): string {
  const now = new Date();
  const key = threadDayKey(iso);
  if (key === threadDayKey(now.toISOString())) return todayLabel;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === threadDayKey(yesterday.toISOString())) return yesterdayLabel;

  const date = new Date(iso);
  return date.toLocaleDateString(locale, {
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}
