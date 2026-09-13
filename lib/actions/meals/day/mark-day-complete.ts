'use server';

import { and, eq, gte, lt } from 'drizzle-orm';
import { markDayCompleteSchema } from '@/lib/api/contracts/meals';
import { getUtcDayRangeForLocalDate } from '@/lib/core/date/local-day';
import { Errors } from '@/lib/core/errors/catalog';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db/client';
import { dayCompletionMarks, meals } from '@/lib/infra/db/schema';

/**
 * Records that the user attests a past day was fully logged.
 *
 * One-way by product decision: there is no un-mark, so this only ever inserts
 * and the confirmation dialog in the client is the sole guard. `ON CONFLICT DO
 * NOTHING` makes a double-tap (or a retried request) a no-op rather than a
 * unique-violation 500.
 */
export async function markDayCompleteAction(input: {
  date: string;
  timezoneOffset: number;
}) {
  const parsed = markDayCompleteSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  const { dayStart, dayEnd } = getUtcDayRangeForLocalDate(
    parsed.date,
    parsed.timezoneOffset
  );

  // Today is still accruing meals and a future day has nothing to attest to, so
  // neither can be "everything I ate". Comparing the requested day's END
  // boundary against now keeps this in the user's own timezone.
  if (dayEnd.getTime() > Date.now()) {
    throw Errors.validationFailed('Chỉ có thể xác nhận một ngày đã qua.');
  }

  // An empty day is "unlogged", not "under-logged" — attesting to it would put
  // a zero-calorie day into the averages.
  const [firstMeal] = await db
    .select({ id: meals.id })
    .from(meals)
    .where(
      and(
        eq(meals.userId, user.id),
        gte(meals.loggedAt, dayStart),
        lt(meals.loggedAt, dayEnd)
      )
    )
    .limit(1);

  if (!firstMeal) {
    throw Errors.validationFailed('Ngày này chưa có bữa ăn nào để xác nhận.');
  }

  await db
    .insert(dayCompletionMarks)
    .values({ userId: user.id, localDate: parsed.date })
    .onConflictDoNothing({
      target: [dayCompletionMarks.userId, dayCompletionMarks.localDate],
    });

  return { success: true, markedComplete: true };
}
