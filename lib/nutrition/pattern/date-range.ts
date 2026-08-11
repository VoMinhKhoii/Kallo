import type { SQL, SQLWrapper } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

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

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getNutritionPeriod({
  range,
  now = new Date(),
  timezoneOffset,
}: GetNutritionPeriodOptions): NutritionPeriod {
  const bucketTimezone: BucketTimezone =
    timezoneOffset === null ? 'utc' : 'local';
  const localizedNow = new Date(
    timezoneOffset === null
      ? now.getTime()
      : now.getTime() - timezoneOffset * 60_000
  );
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
      startDate: formatIsoDate(monday),
      endDate: formatIsoDate(sunday),
      bucketTimezone,
    };
  }

  const startDate = new Date(localizedNow);

  startDate.setUTCDate(startDate.getUTCDate() - (RANGE_DAYS[range] - 1));

  return {
    startDate: formatIsoDate(startDate),
    endDate: formatIsoDate(localizedNow),
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
