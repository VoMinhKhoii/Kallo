// The stamp the suites outside this folder mock `stampLoggedAt` with: the
// clock time on the chosen day, as before the day read, without touching
// `db`. The day read itself is tested in logged-at.test.ts.

import { getUtcInstantForLocalDate } from '@/lib/core/date/local-day';

export async function clockStamp(
  _userId: string,
  date: string,
  timezoneOffset: number
): Promise<Date> {
  return getUtcInstantForLocalDate(date, timezoneOffset);
}
