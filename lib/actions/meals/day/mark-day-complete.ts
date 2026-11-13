'use server';

import { markDayCompleteSchema } from '@/lib/api/contracts/meals';
import { getUtcDayRangeForLocalDate } from '@/lib/core/date/local-day';
import { closeDay } from '@/lib/domain/meals/day-completion';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';

/**
 * Records that the user attests a day — past or today — was fully logged.
 * The rules (not a future day, not an empty day, one-way) live in `closeDay`,
 * which the reminder's lock-screen button shares.
 */
export async function markDayCompleteAction(input: {
  date: string;
  timezoneOffset: number;
}) {
  const parsed = markDayCompleteSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  // Resolved in the user's own timezone, so "today" is their today.
  const { dayStart, dayEnd } = getUtcDayRangeForLocalDate(
    parsed.date,
    parsed.timezoneOffset
  );
  await closeDay({ userId: user.id, date: parsed.date, dayStart, dayEnd });

  return { success: true, markedComplete: true };
}
