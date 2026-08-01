import { createHmac } from 'node:crypto';
import { z } from 'zod';
import {
  readBoundedWebhookBody,
  timingSafeMatch,
} from '@/lib/security/webhook-request';

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

/** Read this webhook's body under RevenueCat's own size cap. */
export function readRevenueCatBody(request: Request): Promise<string> {
  return readBoundedWebhookBody(request, MAX_WEBHOOK_BYTES);
}
