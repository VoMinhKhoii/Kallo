import { and, eq, sql } from 'drizzle-orm';
import {
  payloadForAudit,
  type RevenueCatEvent,
  type RevenueCatWebhookBody,
} from '@/app/api/webhooks/revenuecat/_lib/request';
import type { BillingEnvironment } from '@/lib/billing/revenuecat';
import type { AppDb } from '@/lib/db';
import { billingWebhookEvents } from '@/lib/db/schema';

const SOURCE = 'revenuecat';
const MAX_ATTEMPTS = 12;

interface RecordEventOptions {
  database: AppDb;
  body: RevenueCatWebhookBody;
  primaryUserId: string | null;
  billingEnvironment: BillingEnvironment;
  now: Date;
}

export async function recordWebhookAttempt({
  database,
  body,
  primaryUserId,
  billingEnvironment,
  now,
}: RecordEventOptions): Promise<
  { duplicate: true } | { duplicate: false; eventRowId: string }
> {
  const event = body.event;
  const inserted = await database
    .insert(billingWebhookEvents)
    .values({
      source: SOURCE,
      externalEventId: event.id,
      eventType: event.type,
      userId: primaryUserId,
      rawPayload: payloadForAudit(body),
      eventTimestamp: new Date(event.event_timestamp_ms),
      environment: event.environment?.toLowerCase() ?? null,
      deploymentEnvironment: billingEnvironment,
      providerAppId: event.app_id ?? null,
      createdAt: now,
    })
    .onConflictDoNothing({
      target: [
        billingWebhookEvents.source,
        billingWebhookEvents.externalEventId,
        billingWebhookEvents.deploymentEnvironment,
      ],
    })
    .returning({ id: billingWebhookEvents.id });

  let eventRowId = inserted[0]?.id;
  if (!eventRowId) {
    const existing = await database
      .select({
        id: billingWebhookEvents.id,
        processedAt: billingWebhookEvents.processedAt,
        deadLetteredAt: billingWebhookEvents.deadLetteredAt,
      })
      .from(billingWebhookEvents)
      .where(
        and(
          eq(billingWebhookEvents.source, SOURCE),
          eq(billingWebhookEvents.externalEventId, event.id),
          eq(billingWebhookEvents.deploymentEnvironment, billingEnvironment)
        )
      )
      .limit(1);
    if (
      !existing[0] ||
      existing[0].processedAt !== null ||
      existing[0].deadLetteredAt !== null
    ) {
      return { duplicate: true };
    }
    eventRowId = existing[0].id;
  }

  await database
    .update(billingWebhookEvents)
    .set({
      attemptCount: sql`${billingWebhookEvents.attemptCount} + 1`,
      lastAttemptAt: now,
    })
    .where(eq(billingWebhookEvents.id, eventRowId));

  return { duplicate: false, eventRowId };
}

export async function finishWebhookEvent(
  database: AppDb,
  eventRowId: string,
  event: RevenueCatEvent,
  now: Date,
  processingError: string | null = null,
  scrubUserId = false
): Promise<void> {
  await database
    .update(billingWebhookEvents)
    .set({
      processedAt: now,
      processingError,
      nextAttemptAt: null,
      deadLetteredAt: null,
      ...(scrubUserId ? { userId: null } : {}),
      // Pending rows retain replay data. Processed rows only need indexed
      // audit fields and a minimal event marker.
      rawPayload: { event: { id: event.id, type: event.type } },
    })
    .where(eq(billingWebhookEvents.id, eventRowId));
}

export async function failWebhookEvent(
  database: AppDb,
  eventRowId: string,
  now: Date,
  error: unknown
): Promise<void> {
  const rawMessage =
    error instanceof Error ? error.message : 'unknown_processing_error';
  const message =
    rawMessage.length > 500 ? rawMessage.slice(0, 500) : rawMessage;
  const permanent =
    message === 'unresolvable_user' ||
    message === 'unresolvable_transfer_destination' ||
    message === 'ambiguous_transfer_destination' ||
    message === 'ownership_transfer_disabled' ||
    message === 'unresolvable_redemption_destination' ||
    message === 'revenuecat_ownership_conflict' ||
    message === 'missing_redemption_outcome' ||
    message === 'ambiguous_user' ||
    message === 'invalid_event_environment';

  await database
    .update(billingWebhookEvents)
    .set({
      processingError: message,
      nextAttemptAt: permanent
        ? null
        : sql`${now} + (LEAST(3600, POWER(2, ${billingWebhookEvents.attemptCount})::integer) * interval '1 second')`,
      deadLetteredAt: permanent
        ? now
        : sql`CASE WHEN ${billingWebhookEvents.attemptCount} >= ${MAX_ATTEMPTS} THEN ${now} ELSE NULL END`,
    })
    .where(eq(billingWebhookEvents.id, eventRowId));
}
