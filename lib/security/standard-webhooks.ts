import { createHmac } from 'node:crypto';
import { timingSafeMatch } from '@/lib/security/webhook-request';

/**
 * Verifier for the [Standard Webhooks](https://www.standardwebhooks.com/)
 * signature scheme, which is what Supabase Auth uses to sign its HTTP hooks.
 *
 * Implemented against `node:crypto` rather than pulling in the
 * `standardwebhooks` package: the whole scheme is one HMAC and a timestamp
 * check, and a dependency in the auth path is a dependency that can break
 * every sign-up.
 *
 * The signed content is `${webhook-id}.${webhook-timestamp}.${rawBody}`, HMAC-
 * SHA256'd with the base64-decoded secret and compared base64-to-base64.
 */

/** How far the sender's clock may drift before a request is rejected. */
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

/** Symmetric signatures carry the `v1,` prefix; `v1a,` is asymmetric (ed25519). */
const SYMMETRIC_PREFIX = 'v1,';

export interface WebhookSignatureHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

/** Pull the three signature headers off a request. */
export function readSignatureHeaders(
  request: Request
): WebhookSignatureHeaders {
  return {
    id: request.headers.get('webhook-id'),
    timestamp: request.headers.get('webhook-timestamp'),
    signature: request.headers.get('webhook-signature'),
  };
}

/**
 * Strip the `v1,whsec_` prefix Supabase shows in its dashboard and decode the
 * remaining base64 into the raw HMAC key. A secret pasted without the prefix
 * still works.
 */
function decodeSecret(secret: string): Buffer {
  const base64 = secret
    .trim()
    .replace(/^v1,/, '')
    .replace(/^whsec_/, '');
  return Buffer.from(base64, 'base64');
}

/**
 * Verify a Standard Webhooks signature.
 *
 * @param rawBody — the exact body bytes as received, never a re-serialised object.
 * @param headers — the three `webhook-*` headers.
 * @param secret  — the shared secret, with or without the `v1,whsec_` prefix.
 * @param now     — injectable clock for tests.
 */
export function verifyStandardWebhook(
  rawBody: string,
  headers: WebhookSignatureHeaders,
  secret: string,
  now: Date = new Date()
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !secret) return false;
  if (!/^\d+$/.test(timestamp)) return false;

  // Reject replays of an old (or impossibly future) capture.
  const ageSeconds = Math.abs(now.getTime() / 1000 - Number(timestamp));
  if (ageSeconds > TIMESTAMP_TOLERANCE_SECONDS) return false;

  const key = decodeSecret(secret);
  if (key.length === 0) return false;

  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest('base64');

  // During a key rotation the sender signs with both keys and sends the
  // signatures space-delimited, so any one match authenticates the request.
  return signature
    .split(' ')
    .filter((part) => part.startsWith(SYMMETRIC_PREFIX))
    .some((part) =>
      timingSafeMatch(expected, part.slice(SYMMETRIC_PREFIX.length))
    );
}
