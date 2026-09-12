'use server';

import { and, eq, gte, lt } from 'drizzle-orm';
import { z } from 'zod';
import { getUtcDayRangeForLocalDate } from '@/lib/core/date/local-day';
import {
  dateStringSchema,
  timezoneOffsetSchema,
} from '@/lib/core/validation/primitives';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db/client';
import { meals, pendingAnalyses } from '@/lib/infra/db/schema';

/**
 * Whether a local day holds anything at all — a saved meal or an analysis
 * staged and not yet confirmed.
 *
 * Read on the SERVER, before the logging page is sent, so the first frame the
 * browser paints already knows whether the composer belongs in the middle of an
 * empty day or docked under a list of meals. Without it the browser has to
 * guess, and the correction when the real day load lands is the composer
 * visibly moving across the screen.
 *
 * Deliberately not `loadLoggingDay`: this needs one bit, not the day. Two
 * indexed existence checks cost a fraction of the full load — and the full load
 * also reaps abandoned staging rows, which is a WRITE that has no business
 * running just because someone opened a page.
 */
const dayHasEntriesSchema = z.object({
  date: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});

export async function dayHasEntries(input: {
  date: string;
  timezoneOffset: number;
}): Promise<boolean> {
  const parsed = dayHasEntriesSchema.parse(input);
  const { user } = await requireAuthAndProfile();
  const { dayStart, dayEnd } = getUtcDayRangeForLocalDate(
    parsed.date,
    parsed.timezoneOffset
  );

  const [meal, pending] = await Promise.all([
    db
      .select({ id: meals.id })
      .from(meals)
      .where(
        and(
          eq(meals.userId, user.id),
          gte(meals.loggedAt, dayStart),
          lt(meals.loggedAt, dayEnd)
        )
      )
      .limit(1),
    db
      .select({ id: pendingAnalyses.id })
      .from(pendingAnalyses)
      .where(
        and(
          eq(pendingAnalyses.userId, user.id),
          gte(pendingAnalyses.loggedAt, dayStart),
          lt(pendingAnalyses.loggedAt, dayEnd)
        )
      )
      .limit(1),
  ]);

  return meal.length > 0 || pending.length > 0;
}
