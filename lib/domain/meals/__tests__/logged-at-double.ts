// The stamp the suites outside this folder mock `stampLoggedAt` with: the
// clock time on the chosen day, as before the day read, and whether that day is
// past, without touching `db`. The day read itself is tested in
// logged-at.test.ts.

import { getUtcInstantForLocalDate } from '@/lib/core/date/local-day';
// Type only, and `isPastLocalDay` restated below: the suites mock
// logged-at.ts itself with this double.
import type { LoggedAtStamp } from '@/lib/domain/meals/logged-at';

export function pastLocalDay(
  date: string,
  timezoneOffset: number,
  now = new Date()
): boolean {
  return (
    getUtcInstantForLocalDate(date, timezoneOffset, now).getTime() <
    now.getTime()
  );
}

export async function clockStamp(
  _userId: string,
  date: string,
  timezoneOffset: number,
  now = new Date()
): Promise<LoggedAtStamp> {
  return {
    loggedAt: getUtcInstantForLocalDate(date, timezoneOffset, now),
    backfilled: pastLocalDay(date, timezoneOffset, now),
  };
}
