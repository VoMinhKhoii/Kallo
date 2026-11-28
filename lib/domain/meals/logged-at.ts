import { and, eq, gte, lt, max, sql } from 'drizzle-orm';
import { isStillStaged } from '@/lib/actions/meals/day/abandoned';
import { toLocalDayKey } from '@/lib/core/date/day-key';
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
 * had already passed (stored as `backfilled`, read by the Circle feed). */
export interface LoggedAtStamp {
  loggedAt: Date;
  backfilled: boolean;
}

/**
 * Whether the local day `date` is before the user's own today at `now`: its
 * clock-time instant (today's time of day, on that day) is already past.
 */
export function isPastLocalDay(
  date: string,
  timezoneOffset: number,
  now = new Date()
): boolean {
  return (
    getUtcInstantForLocalDate(date, timezoneOffset, now).getTime() <
    now.getTime()
  );
}

/**
 * Whether the instant `at` falls on a local day before the user's today at
 * `now`. The flag for a meal that keeps an instant it did not stamp: a refine
 * keeps the original's, and a friend's meal copied into my diary keeps theirs.
 */
export function isOnPastLocalDay(
  at: Date,
  timezoneOffset: number,
  now = new Date()
): boolean {
  return toLocalDayKey(at, timezoneOffset) < toLocalDayKey(now, timezoneOffset);
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
  if (!isPastLocalDay(date, timezoneOffset, now)) {
    return { loggedAt: clockTime, backfilled: false };
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
    backfilled: true,
  };
}
