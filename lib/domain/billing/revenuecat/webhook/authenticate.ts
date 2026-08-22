import { createHmac } from 'node:crypto';
import {
  isInformationalRevenueCatEvent,
  type RevenueCatEvent,
  readRevenueCatBody,
} from '@/lib/domain/billing/revenuecat/webhook/parse';
import {
  timingSafeMatch,
  WebhookPayloadTooLargeError,
} from '@/lib/infra/security/webhook-request';

// May this request mutate billing state? Two independent questions: the
// shared secret or HMAC signature the caller carries, and the RevenueCat app
// the event claims to come from. Both must answer yes before the event is
// recorded, so an unauthenticated caller cannot fill the audit table.

export interface RevenueCatAuthFailure {
  status: number;
  error: string;
}

export type RevenueCatAuthResult =
  | { ok: true; rawBody: string }
  | { ok: false; failure: RevenueCatAuthFailure };

export function verifyRevenueCatHmac(
  rawBody: string,
  header: string | null,
  secret: string,
  now: Date
): boolean {
  if (!header) return false;
  const parts = new Map(
    header
      .split(',')
      .map((part) => part.trim().split('=', 2) as [string, string])
  );
  const timestamp = parts.get('t');
  const signature = parts.get('v1');
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  const ageSeconds = Math.abs(now.getTime() / 1000 - Number(timestamp));
  if (ageSeconds > 300) return false;
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return timingSafeMatch(expected, signature);
}

export function allowedRevenueCatAppIds(): Set<string> {
  return new Set(
    (process.env.REVENUECAT_ALLOWED_APP_IDS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

/**
 * Verify the caller and hand back the exact bytes that were signed. HMAC wins
 * when both secrets are configured; the bearer secret is the fallback for
 * integrations RevenueCat has not moved to signatures yet.
 */
export async function authenticateRevenueCatRequest(
  request: Request,
  now: Date
): Promise<RevenueCatAuthResult> {
  const authorizationSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  const hmacSecret = process.env.REVENUECAT_WEBHOOK_HMAC_SECRET;
  if (!authorizationSecret && !hmacSecret) {
    console.error('RevenueCat webhook authentication is not configured.');
    return {
      ok: false,
      failure: { status: 503, error: 'webhook_not_configured' },
    };
  }

  if (
    !hmacSecret &&
    (!authorizationSecret ||
      !request.headers.get('authorization') ||
      !timingSafeMatch(
        request.headers.get('authorization') as string,
        authorizationSecret
      ))
  ) {
    return { ok: false, failure: { status: 401, error: 'unauthorized' } };
  }

  let rawBody: string;
  try {
    rawBody = await readRevenueCatBody(request);
  } catch (error) {
    if (error instanceof WebhookPayloadTooLargeError) {
      return {
        ok: false,
        failure: { status: 413, error: 'payload_too_large' },
      };
    }
    throw error;
  }

  const authenticated = hmacSecret
    ? verifyRevenueCatHmac(
        rawBody,
        request.headers.get('x-revenuecat-webhook-signature'),
        hmacSecret,
        now
      )
    : true;
  if (!authenticated) {
    return { ok: false, failure: { status: 401, error: 'unauthorized' } };
  }

  return { ok: true, rawBody };
}

/**
 * Confine grant-mutating events to the RevenueCat apps this deployment owns.
 * Returns the failure to send, or `null` when the event may proceed.
 */
export function checkRevenueCatAppAllowed(
  event: RevenueCatEvent
): RevenueCatAuthFailure | null {
  const allowedAppIds = allowedRevenueCatAppIds();
  const informational = isInformationalRevenueCatEvent(event.type);

  if (!informational && allowedAppIds.size === 0) {
    console.error(
      'REVENUECAT_ALLOWED_APP_IDS is required for billing webhooks.'
    );
    return { status: 503, error: 'revenuecat_app_allowlist_not_configured' };
  }
  if (allowedAppIds.size > 0 && !informational && !event.app_id) {
    return { status: 401, error: 'missing_revenuecat_app' };
  }
  if (
    event.app_id &&
    allowedAppIds.size > 0 &&
    !allowedAppIds.has(event.app_id)
  ) {
    return { status: 401, error: 'unexpected_revenuecat_app' };
  }
  return null;
}
