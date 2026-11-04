import 'server-only';
import { createHmac } from 'node:crypto';
import { timingSafeMatch } from '@/lib/infra/security/webhook-request';

/**
 * The capability a reminder's "That was all" / "I'm done for today" button
 * carries: close THIS day for THIS user, until it expires.
 *
 * The button runs from the lock screen, in the background, with no app UI and
 * possibly no running Flutter engine — so it cannot ride the user's Supabase
 * session (refreshing that natively would rotate the refresh token out from
 * under the app). Instead the server signs the one action into the push
 * itself, and the device posts it back. Worst case for a leaked token: one
 * day of one account is marked complete before it expires, which is exactly
 * what its owner's button would have done.
 *
 * Format: `<userId>.<YYYY-MM-DD>.<expires unix s>.<base64url HMAC-SHA256>`,
 * keyed by `REMINDER_ACTION_SECRET`.
 */

/** Long enough to answer the 21:00 reminder the next morning. */
export const ACTION_TOKEN_TTL_MS = 36 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function signature(secret: string, payload: string): string {
  return createHmac('sha256', secret)
    .update(`close-day|${payload}`)
    .digest('base64url');
}

export function signCloseDayToken(
  secret: string,
  input: { userId: string; date: string; now: Date }
): string {
  const expires = Math.floor(
    (input.now.getTime() + ACTION_TOKEN_TTL_MS) / 1000
  );
  const payload = `${input.userId}.${input.date}.${expires}`;
  return `${payload}.${signature(secret, payload)}`;
}

/** The day to close, or null for anything forged, malformed or expired. */
export function verifyCloseDayToken(
  secret: string,
  token: string,
  now: Date
): { userId: string; date: string } | null {
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [userId, date, expires, sig] = parts;
  if (!UUID.test(userId) || !DATE.test(date) || !/^\d{1,12}$/.test(expires)) {
    return null;
  }
  const payload = `${userId}.${date}.${expires}`;
  if (!timingSafeMatch(sig, signature(secret, payload))) return null;
  if (Number(expires) * 1000 <= now.getTime()) return null;
  return { userId, date };
}
