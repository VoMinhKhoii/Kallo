import 'server-only';
import { Errors } from '@/lib/core/errors/catalog';
import { closeDay } from '@/lib/domain/meals/day-completion';
import { verifyCloseDayToken } from './action-token';

/**
 * "That was all" / "I'm done for today", pressed on the lock screen. The token
 * names the user, the day and that day's UTC bounds as the reminder computed
 * them (`action-token.ts`); `closeDay` applies the same rules as the in-app
 * button (no future day, no empty day, one-way, idempotent).
 */
export async function closeDayFromReminder(input: {
  token: string;
  secret: string;
  now?: Date;
}): Promise<{ date: string }> {
  const now = input.now ?? new Date();
  const claim = verifyCloseDayToken(input.secret, input.token, now);
  if (!claim) throw Errors.notAuthenticated('Reminder action expired.');
  await closeDay({ ...claim, now });
  return { date: claim.date };
}
