import { z } from 'zod';
import { canonicalizeEmailForKey } from '@/lib/core/text/email';
import { readBodyField } from './auth-body';

/**
 * WHO an auth request acts on, as a rate-limit key value.
 *
 * The strict budgets (`authEmailRecipient`, `authLoginAccount`) are keyed on
 * the thing being attacked rather than on the attacker, which is what makes
 * them survive IP rotation. This module produces that value, and only that
 * value: it is never what gets forwarded upstream.
 *
 * Two namespaces share the key space, so they are kept apart by construction:
 * a canonical email (always contains `@`) and `phone:<digits>`.
 *
 * There is deliberately NO key derived from a bearer token's `sub`. The proxy
 * holds no JWKS, so a token here is cryptographically UNVERIFIED — a forged
 * `sub` would let an attacker consume another account's budget before Supabase
 * ever authenticates the request. Operations that name no target in their body
 * (reauthentication) are therefore limited by their IP and global budgets only.
 */

/**
 * RFC 5321 caps a path at 256 and a domain at 255; 320 is the widest address
 * anyone quotes. This is a CAP, not a filter — an over-long value is truncated
 * onto a (shared, therefore stricter) key rather than dropped. Dropping it was
 * a bypass: a 255-character address became "no target", and the per-recipient
 * budget it should have consumed was skipped entirely.
 */
const MAX_KEY_CHARS = 320;

/**
 * Zod rather than a cast, because these values come off the wire: a body of
 * `{"email": {"toLowerCase": …}}` or `{"email": 12}` must produce "no target",
 * not a TypeError inside the limiter and a 500 in front of auth.
 */
const targetField = z.string().min(1);

function capped(value: string): string {
  return value.length > MAX_KEY_CHARS ? value.slice(0, MAX_KEY_CHARS) : value;
}

/**
 * GoTrue's own `formatPhoneNumber` strips every non-digit, so `+84 90 000
 * 0000`, `+84900000000` and `84900000000` are one number upstream and must be
 * one counter here.
 */
function phoneKey(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  return digits.length > 0 ? capped(`phone:${digits}`) : null;
}

function emailKey(value: string): string | null {
  const canonical = canonicalizeEmailForKey(value);
  return canonical.length > 0 ? capped(canonical) : null;
}

/**
 * The target this body names — email first, then phone.
 *
 * `null` means the body named neither. For the operations that cannot be keyed
 * any other way that is a refusal, not a pass; see `requiresTarget`.
 */
export function targetKeyFromBody(
  body: Record<string, unknown> | undefined
): string | null {
  const email = targetField.safeParse(readBodyField(body, 'email'));
  if (email.success && email.data.trim().length > 0) {
    return emailKey(email.data);
  }

  const phone = targetField.safeParse(readBodyField(body, 'phone'));
  if (phone.success) return phoneKey(phone.data);

  return null;
}
