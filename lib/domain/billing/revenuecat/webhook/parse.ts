import { z } from 'zod';
import { readBoundedWebhookBody } from '@/lib/infra/security/webhook-request';

// The webhook envelope: what RevenueCat may send us, what we are willing to
// read, and what we are willing to keep. Nothing here trusts the caller or
// touches the database — `authenticate.ts` decides trust, `event-store.ts`
// persists.

export const MAX_WEBHOOK_BYTES = 256 * 1024;

export const revenueCatEventSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    event_timestamp_ms: z.number().int().nonnegative(),
    app_id: z.string().nullish(),
    app_user_id: z.string().nullish(),
    original_app_user_id: z.string().nullish(),
    aliases: z.array(z.string()).nullish(),
    transferred_from: z.array(z.string()).nullish(),
    transferred_to: z.array(z.string()).nullish(),
    redeemed_from: z.array(z.string()).nullish(),
    redeemed_by: z.array(z.string()).nullish(),
    redemption_outcome: z
      .enum(['alias', 'transfer', 'redeemer_owns'])
      .nullish(),
    environment: z.string().nullish(),
  })
  .passthrough();

export const revenueCatBodySchema = z
  .object({ event: revenueCatEventSchema })
  .passthrough();

export type RevenueCatEvent = z.infer<typeof revenueCatEventSchema>;
export type RevenueCatWebhookBody = z.infer<typeof revenueCatBodySchema>;

/** Read this webhook's body under RevenueCat's own size cap. */
export function readRevenueCatBody(request: Request): Promise<string> {
  return readBoundedWebhookBody(request, MAX_WEBHOOK_BYTES);
}

export type ParsedRevenueCatBody =
  | { ok: true; body: RevenueCatWebhookBody }
  | { ok: false; error: string; detail?: string };

/**
 * Parse the raw body the signature was verified over. Kept separate from the
 * read so the exact bytes reach the HMAC check unmodified.
 */
export function parseRevenueCatWebhookBody(
  rawBody: string
): ParsedRevenueCatBody {
  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawBody);
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
  const parsed = revenueCatBodySchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid_payload',
      detail: parsed.error.issues[0]?.message,
    };
  }
  return { ok: true, body: parsed.data };
}

/**
 * Event types that carry no billing state. They are recorded for audit and
 * finalized without a CustomerInfo fetch, and are exempt from the app
 * allowlist because they cannot move a grant.
 */
export function isInformationalRevenueCatEvent(type: string): boolean {
  return (
    type === 'TEST' ||
    type.startsWith('PAYWALL_') ||
    type === 'VIRTUAL_CURRENCY_TRANSACTION' ||
    type === 'EXPERIMENT_ENROLLMENT'
  );
}

export function payloadForAudit(body: RevenueCatWebhookBody) {
  const event = body.event;
  // Persist only the replay/identity/routing envelope we actively consume.
  // The validation schema remains passthrough for provider compatibility, but
  // newly added provider fields must never become stored PII by accident.
  return {
    event: {
      id: event.id,
      type: event.type,
      event_timestamp_ms: event.event_timestamp_ms,
      app_id: event.app_id ?? null,
      app_user_id: event.app_user_id ?? null,
      original_app_user_id: event.original_app_user_id ?? null,
      aliases: event.aliases ?? null,
      transferred_from: event.transferred_from ?? null,
      transferred_to: event.transferred_to ?? null,
      redeemed_from: event.redeemed_from ?? null,
      redeemed_by: event.redeemed_by ?? null,
      redemption_outcome: event.redemption_outcome ?? null,
      environment: event.environment ?? null,
    },
  };
}
