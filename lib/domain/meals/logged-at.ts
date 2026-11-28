import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { isStillStaged } from '@/lib/actions/meals/day/abandoned';
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

/**
 * The instant a new meal logged for the local day `date` is stamped with.
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
): Promise<Date> {
  const clockTime = getUtcInstantForLocalDate(date, timezoneOffset, now);
  // Today (or a future day): nothing on it can be later than now.
  if (clockTime.getTime() >= now.getTime()) return clockTime;

  const { dayStart, dayEnd } = getUtcDayRangeForLocalDate(date, timezoneOffset);
  // One after the other, not in parallel: the instance's DB pool is small.
  const [latestMeal] = await db
    .select({ loggedAt: meals.loggedAt })
    .from(meals)
    .where(
      and(
        eq(meals.userId, userId),
        gte(meals.loggedAt, dayStart),
        lt(meals.loggedAt, dayEnd)
      )
    )
    .orderBy(desc(meals.loggedAt))
    .limit(1);
  const [latestStaged] = await db
    .select({ loggedAt: pendingAnalyses.loggedAt })
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
    )
    .orderBy(desc(pendingAnalyses.loggedAt))
    .limit(1);

  const latest = [
    latestMeal?.loggedAt,
    latestStaged?.loggedAt,
  ].reduce<Date | null>(
    (acc, at) => (at && (!acc || at > acc) ? at : acc),
    null
  );
  return placeAfterLatest(clockTime, latest, dayEnd);
}
