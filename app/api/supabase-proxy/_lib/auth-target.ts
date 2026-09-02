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
 * Three namespaces share the key space, so they are kept apart by construction:
 * a canonical email (always contains `@`), `phone:<digits>`, and `user:<sub>`
 * for the bearer-identified operations that name no target in their body.
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

const jwtPayload = z.object({ sub: z.string().min(1) });

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

/**
 * The `sub` claim of a bearer JWT, as a key.
 *
 * `GET /reauthenticate` sends a nonce to the caller's own address and names no
 * target in a body — the account is whoever the access token says it is. The
 * payload is base64url-decoded and read; the signature is NOT verified,
 * because this is a counter identity, not an authorization decision. A forged
 * token buys the forger a key that Supabase will then reject, and every
 * failure mode here returns `null`, which leaves the request on its IP and
 * global budgets.
 */
export function bearerSubjectKey(authorization: string | null): string | null {
  if (!authorization) return null;

  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  const segments = match?.[1].split('.');
  if (!segments || segments.length !== 3) return null;

  try {
    const payload = jwtPayload.safeParse(
      JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'))
    );

    return payload.success ? capped(`user:${payload.data.sub}`) : null;
  } catch {
    return null;
  }
}
