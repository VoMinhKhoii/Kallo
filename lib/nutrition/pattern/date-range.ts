import type { SQL, SQLWrapper } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

import {
  dayKeyToUtcDate,
  toLocalCalendarDate,
  toUtcDayKey,
} from '@/lib/date/day-key';
import { MS_PER_DAY } from '@/lib/date/ms';
import type { BucketTimezone, NutritionRange } from '../types';

const RANGE_DAYS: Record<NutritionRange, number> = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

interface GetNutritionPeriodOptions {
  range: NutritionRange;
  now?: Date;
  timezoneOffset: number | null;
}

interface NutritionPeriod {
  startDate: string;
  endDate: string;
  bucketTimezone: BucketTimezone;
}

export function getNutritionPeriod({
  range,
  now = new Date(),
  timezoneOffset,
}: GetNutritionPeriodOptions): NutritionPeriod {
  const bucketTimezone: BucketTimezone =
    timezoneOffset === null ? 'utc' : 'local';
  // A null offset means "bucket in UTC", which is the zero shift.
  const localizedNow = toLocalCalendarDate(now, timezoneOffset ?? 0);
  // 7d is the CURRENT calendar week, Monday→Sunday — not a trailing seven days.
  // A window that starts on a rolling weekday can't be compared week to week,
  // and the weekday initials under the columns stop lining up with anything.
  // The tail of the week is simply empty until it is lived.
  if (range === '7d') {
    const monday = new Date(localizedNow);
    // getUTCDay() is Sun=0; shift so Monday is 0.
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    return {
      startDate: toUtcDayKey(monday),
      endDate: toUtcDayKey(sunday),
      bucketTimezone,
    };
  }

  const startDate = new Date(localizedNow);

  startDate.setUTCDate(startDate.getUTCDate() - (RANGE_DAYS[range] - 1));

  return {
    startDate: toUtcDayKey(startDate),
    endDate: toUtcDayKey(localizedNow),
    bucketTimezone,
  };
}

export function localDateSqlExpression(
  column: SQL | SQLWrapper,
  timezoneOffset: number | null
): SQL<string> {
  if (timezoneOffset === null) {
    return sql<string>`((${column}) AT TIME ZONE 'UTC')::date`;
  }

  // Postgres interval string built from a numeric literal — safe from
  // injection because timezoneOffset is a JS number.
  const offsetMinutes = -timezoneOffset;
  return sql<string>`(((${column}) AT TIME ZONE 'UTC') + (${sql.raw(`'${offsetMinutes} minutes'`)})::interval)::date`;
}

/**
 * The window of the same length immediately before [period] — 7d compares
 * against the previous seven days, 30d the previous thirty, and so on.
 *
 * Length is measured inclusively from the period's own dates rather than from
 * `RANGE_DAYS`, so the 7d calendar week (which can run past today) still maps
 * to exactly the week before it.
 */
export function getPreviousPeriod(period: {
  startDate: string;
  endDate: string;
}): { startDate: string; endDate: string } {
  const start = dayKeyToUtcDate(period.startDate);
  const end = dayKeyToUtcDate(period.endDate);
  const days = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;

  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - (days - 1));

  return {
    startDate: toUtcDayKey(previousStart),
    endDate: toUtcDayKey(previousEnd),
  };
}
