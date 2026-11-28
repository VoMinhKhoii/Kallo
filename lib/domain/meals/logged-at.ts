import { and, eq, gte, lt, max, sql } from 'drizzle-orm';
import { isStillStaged } from '@/lib/actions/meals/day/abandoned';
import { isPastDayKey } from '@/lib/core/date/day-key';
import {
  getUtcDayRangeForLocalDate,
  getUtcInstantForLocalDate,
} from '@/lib/core/date/local-day';
import { db } from '@/lib/infra/db/client';
import { meals, pendingAnalyses } from '@/lib/infra/db/schema';

const ONE_MINUTE_MS = 60 * 1000;

/**
 * Where a meal logged on a past day goes: at today's clock time on that day,
 * unless the day already has a meal at or after it, then one minute after the
 * day's latest meal (kept inside the day). Both apps list a day by `loggedAt`,
 * so a meal logged late shows last, below the meals logged before it.
 */
export function placeAfterLatest(
  clockTime: Date,
  latest: Date | null,
  dayEnd: Date
): Date {
  if (!latest || latest.getTime() < clockTime.getTime()) return clockTime;
  return new Date(
    Math.min(latest.getTime() + ONE_MINUTE_MS, dayEnd.getTime() - 1)
  );
}

/** A new meal's stamp: where it sits, and whether it was logged for a day that
 * had already passed (stored as `is_backfilled`, read by the Circle feed). */
export interface LoggedAtStamp {
  loggedAt: Date;
  isBackfilled: boolean;
}

/**
 * The instant a new meal logged for the local day `date` is stamped with, and
 * whether that day had already passed.
 *
 * Today it is now. A past day takes today's clock time, which alone put a meal
 * logged at noon for yesterday above yesterday's 2 pm meal; `placeAfterLatest`
 * moves it below the day's latest saved or staged meal instead.
 */
export async function stampLoggedAt(
  userId: string,
  date: string,
  timezoneOffset: number,
  now = new Date()
): Promise<LoggedAtStamp> {
  const clockTime = getUtcInstantForLocalDate(date, timezoneOffset, now);
  // Today (or a future day): nothing on it can be later than now.
  if (!isPastDayKey(date, timezoneOffset, now)) {
    return { loggedAt: clockTime, isBackfilled: false };
  }

  const { dayStart, dayEnd } = getUtcDayRangeForLocalDate(date, timezoneOffset);
  const latestMeal = db
    .select({ at: max(meals.loggedAt) })
    .from(meals)
    .where(
      and(
        eq(meals.userId, userId),
        gte(meals.loggedAt, dayStart),
        lt(meals.loggedAt, dayEnd)
      )
    );
  const latestStaged = db
    .select({ at: max(pendingAnalyses.loggedAt) })
    .from(pendingAnalyses)
    .where(
      and(
        eq(pendingAnalyses.userId, userId),
        gte(pendingAnalyses.loggedAt, dayStart),
        lt(pendingAnalyses.loggedAt, dayEnd),
        // The day view's line: an abandoned row it hides must not push the
        // new meal past it.
        isStillStaged()
      )
    );
  // One round trip; GREATEST skips a NULL (a day with no meal of that kind).
  const [row] = await db.execute<{ latest: string | Date | null }>(
    sql`select greatest((${latestMeal}), (${latestStaged})) as latest`
  );
  const latest = row?.latest ? new Date(row.latest) : null;
  return {
    loggedAt: placeAfterLatest(clockTime, latest, dayEnd),
    isBackfilled: true,
  };
}
