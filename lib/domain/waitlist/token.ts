import { createHash, createHmac, randomBytes } from 'node:crypto';

/**
 * Confirmation tokens for the waitlist double opt-in, plus the IP pepper used
 * by its rate limiter.
 *
 * The token is a bearer credential: whoever holds it can confirm that address.
 * So the plaintext exists only in the email, and only its SHA-256 is stored —
 * a database leak then reveals nothing that can be redeemed. Plain SHA-256 (not
 * a password hash) is right here because the input is 32 bytes of CSPRNG
 * output, which has nothing to brute-force.
 */

/** How long a confirmation link stays valid. */
export const CONFIRMATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface ConfirmationToken {
  /** Goes in the email link. Never persisted. */
  token: string;
  /** Goes in the database. */
  tokenHash: string;
  expiresAt: Date;
}

export function issueConfirmationToken(
  now: Date = new Date()
): ConfirmationToken {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashConfirmationToken(token),
    expiresAt: new Date(now.getTime() + CONFIRMATION_TTL_MS),
  };
}

export function hashConfirmationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const TEST_PEPPER = 'waitlist-test-pepper';

/**
 * Pepper for the IP hash. Reuses `ANALYSIS_GUARD_HASH_SECRET` — the same
 * secret already peppers IPs elsewhere (lib/rate-limit/analysis-guards.ts), and
 * a second secret to rotate would be one more thing to get wrong.
 */
function ipPepper(): string {
  const secret = process.env.ANALYSIS_GUARD_HASH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'test') return TEST_PEPPER;
  throw new Error('ANALYSIS_GUARD_HASH_SECRET is required');
}

/** Keyed hash of a client IP. Raw addresses are never stored. */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHmac('sha256', ipPepper())
    .update(`waitlist_ip:${ip}`)
    .digest('hex');
}
