import 'server-only';
import { eq } from 'drizzle-orm';
import { zonedDayRange } from '@/lib/core/date/zoned';
import { Errors } from '@/lib/core/errors/catalog';
import { closeDay } from '@/lib/domain/meals/day-completion';
import { db } from '@/lib/infra/db/client';
import { userProfiles } from '@/lib/infra/db/schema';
import { verifyCloseDayToken } from './action-token';

/**
 * "That was all" / "I'm done for today", pressed on the lock screen. The token
 * names the user and the day (`action-token.ts`); the day's bounds come from
 * the time zone the reminder was scheduled in, and `closeDay` applies the same
 * rules as the in-app button (no empty day, one-way, idempotent).
 */
export async function closeDayFromReminder(input: {
  token: string;
  secret: string;
  now?: Date;
}): Promise<{ date: string }> {
  const now = input.now ?? new Date();
  const claim = verifyCloseDayToken(input.secret, input.token, now);
  if (!claim) throw Errors.notAuthenticated('Reminder action expired.');

  const [profile] = await db
    .select({ timeZone: userProfiles.timeZone })
    .from(userProfiles)
    .where(eq(userProfiles.userId, claim.userId))
    .limit(1);
  // The token is only minted for users with a zone; one cleared since (an
  // account deleted, say) has no day to close.
  if (!profile?.timeZone) throw Errors.notAuthenticated();

  await closeDay({
    userId: claim.userId,
    date: claim.date,
    ...zonedDayRange(claim.date, profile.timeZone),
    now,
  });
  return { date: claim.date };
}
