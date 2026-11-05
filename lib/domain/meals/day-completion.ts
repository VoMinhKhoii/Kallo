import 'server-only';
import { and, eq, gte, lt } from 'drizzle-orm';
import { Errors } from '@/lib/core/errors/catalog';
import { db } from '@/lib/infra/db/client';
import { dayCompletionMarks, meals } from '@/lib/infra/db/schema';

/**
 * Close a day: the user attests it holds everything they ate ("Mình ăn đủ
 * rồi" / "That's everything I ate"). The same row silences that day's
 * reminders and lets the progress views count it at its real calories.
 *
 * Today may be closed (only the 21:00 reminder's "I'm done for today" offers
 * it; the app's own screens keep it for past days); a day that has not started
 * yet may not — the caller resolves the day's
 * UTC bounds in the user's own clock and this refuses a start still ahead.
 *
 * One-way by product decision: there is no un-mark, so this only ever inserts,
 * and `ON CONFLICT DO NOTHING` makes a double tap or a retried request a no-op.
 */
export async function closeDay(input: {
  userId: string;
  date: string;
  dayStart: Date;
  dayEnd: Date;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  if (input.dayStart.getTime() > now.getTime()) {
    throw Errors.validationFailed('Chưa thể xác nhận một ngày chưa tới.');
  }

  // An empty day is "unlogged", not "under-logged" — attesting to it would put
  // a zero-calorie day into the averages.
  const [firstMeal] = await db
    .select({ id: meals.id })
    .from(meals)
    .where(
      and(
        eq(meals.userId, input.userId),
        gte(meals.loggedAt, input.dayStart),
        lt(meals.loggedAt, input.dayEnd)
      )
    )
    .limit(1);
  if (!firstMeal) {
    throw Errors.validationFailed('Ngày này chưa có bữa ăn nào để xác nhận.');
  }

  await db
    .insert(dayCompletionMarks)
    .values({ userId: input.userId, localDate: input.date })
    .onConflictDoNothing({
      target: [dayCompletionMarks.userId, dayCompletionMarks.localDate],
    });
}
