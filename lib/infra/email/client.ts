import { Resend } from 'resend';

/**
 * Lazily-constructed Resend client.
 *
 * Mirrors the `db` proxy in lib/db/index.ts: the module must be importable at
 * build time (static page generation, CI) with no `RESEND_API_KEY` present, so
 * the SDK is only instantiated on first use. Callers should gate on
 * `emailSendingConfigured()` before reaching for this.
 */
let cached: Resend | undefined;
let cachedKey: string | undefined;

export function resendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error('RESEND_API_KEY is not set — cannot send email.');
  }
  // Re-create when the key changes so tests can swap it between cases.
  if (!cached || cachedKey !== key) {
    cached = new Resend(key);
    cachedKey = key;
  }
  return cached;
}

/** Test seam: drop the memoised client so the next call re-reads the env. */
export function resetResendClient(): void {
  cached = undefined;
  cachedKey = undefined;
}
