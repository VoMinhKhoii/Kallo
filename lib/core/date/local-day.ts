import { dayKeyToUtcDate, toLocalCalendarDate } from '@/lib/core/date/day-key';
import { MS_PER_DAY } from '@/lib/core/date/ms';

export function getUtcDayRangeForLocalDate(
  date: string,
  timezoneOffset: number
) {
  const offsetMs = timezoneOffset * 60 * 1000;
  const dayStart = dayKeyToUtcDate(date);
  dayStart.setTime(dayStart.getTime() + offsetMs);
  const dayEnd = new Date(dayStart.getTime() + MS_PER_DAY);

  return { dayStart, dayEnd };
}

export function getUtcInstantForLocalDate(
  date: string,
  timezoneOffset: number,
  timeSource = new Date()
) {
  const [year, month, day] = date.split('-').map(Number);
  const localNow = toLocalCalendarDate(timeSource, timezoneOffset);
  const localDateTimeMs =
    Date.UTC(
      year,
      month - 1,
      day,
      localNow.getUTCHours(),
      localNow.getUTCMinutes(),
      localNow.getUTCSeconds(),
      localNow.getUTCMilliseconds()
    ) +
    timezoneOffset * 60 * 1000;

  return new Date(localDateTimeMs);
}
