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

export interface ThreadDay<T> {
  key: string;
  /** The first entry's timestamp — what the day's label is derived from. */
  timestamp: string;
  items: T[];
}

/** Splits an ordered feed into consecutive runs that share a local day, so
 * each day can render as one group under one label. Order is preserved. */
export function groupByThreadDay<T extends { timestamp: string }>(
  entries: readonly T[]
): ThreadDay<T>[] {
  const days: ThreadDay<T>[] = [];
  for (const entry of entries) {
    const key = threadDayKey(entry.timestamp);
    const last = days.at(-1);
    if (last?.key === key) last.items.push(entry);
    else days.push({ key, timestamp: entry.timestamp, items: [entry] });
  }
  return days;
}
