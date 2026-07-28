import { NextResponse } from 'next/server';
import {
  failWebhookEvent,
  finishWebhookEvent,
  recordWebhookAttempt,
} from '@/app/api/webhooks/revenuecat/_lib/event-store';
import {
  existingUserIds,
  identityCandidates,
  preferredIdentityCandidates,
  uniqueUuidCandidates,
} from '@/app/api/webhooks/revenuecat/_lib/identity';
import {
  allowedRevenueCatAppIds,
  isInformationalRevenueCatEvent,
  readBoundedWebhookBody,
  revenueCatBodySchema,
  timingSafeMatch,
  verifyRevenueCatHmac,
  WebhookPayloadTooLargeError,
} from '@/app/api/webhooks/revenuecat/_lib/request';
import {
  type BillingEnvironment,
  fetchRevenueCatSnapshot,
  getBillingEnvironment,
  type RevenueCatSnapshot,
} from '@/lib/billing/revenuecat';
import { type AppDb, db as appDb } from '@/lib/db';
import { reconcileRevenueCatGrantSnapshots } from '@/lib/entitlements/grants';

export const runtime = 'nodejs';

export interface WebhookDeps {
  db?: AppDb;
  now?: () => Date;
  billingEnvironment?: BillingEnvironment;
  fetchSnapshot?: (
    appUserId: string,
    billingEnvironment: BillingEnvironment
  ) => Promise<RevenueCatSnapshot>;
}

export async function POST(request: Request, deps?: WebhookDeps) {
  const database = deps?.db ?? appDb;
  const now = deps?.now?.() ?? new Date();
  const fetchSnapshot =
    deps?.fetchSnapshot ??
    ((appUserId: string, billingEnvironment: BillingEnvironment) =>
      fetchRevenueCatSnapshot(appUserId, { billingEnvironment }));

  const authorizationSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  const hmacSecret = process.env.REVENUECAT_WEBHOOK_HMAC_SECRET;
  if (!authorizationSecret && !hmacSecret) {
    console.error('RevenueCat webhook authentication is not configured.');
    return NextResponse.json(
      { error: 'webhook_not_configured' },
      { status: 503 }
    );
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
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let rawBody: string;
  try {
    rawBody = await readBoundedWebhookBody(request);
  } catch (error) {
    if (error instanceof WebhookPayloadTooLargeError) {
      return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
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
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = revenueCatBodySchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', detail: parsed.error.issues[0]?.message },
      { status: 400 }
    );
  }

  const body = parsed.data;
  const event = body.event;
  const candidates = identityCandidates(event);
  const primaryUserId = candidates[0] ?? null;

  let billingEnvironment: BillingEnvironment;
  try {
    billingEnvironment = getBillingEnvironment(deps?.billingEnvironment);
  } catch (error) {
    console.error('RevenueCat billing environment is not configured.', error);
    return NextResponse.json(
      { error: 'billing_environment_not_configured' },
      { status: 503 }
    );
  }

  const allowedAppIds = allowedRevenueCatAppIds();
  if (!isInformationalRevenueCatEvent(event.type) && allowedAppIds.size === 0) {
    console.error(
      'REVENUECAT_ALLOWED_APP_IDS is required for billing webhooks.'
    );
    return NextResponse.json(
      { error: 'revenuecat_app_allowlist_not_configured' },
      { status: 503 }
    );
  }
  if (
    allowedAppIds.size > 0 &&
    !isInformationalRevenueCatEvent(event.type) &&
    !event.app_id
  ) {
    return NextResponse.json(
      { error: 'missing_revenuecat_app' },
      { status: 401 }
    );
  }
  if (
    event.app_id &&
    allowedAppIds.size > 0 &&
    !allowedAppIds.has(event.app_id)
  ) {
    return NextResponse.json(
      { error: 'unexpected_revenuecat_app' },
      { status: 401 }
    );
  }

  const attempt = await recordWebhookAttempt({
    database,
    body,
    primaryUserId,
    billingEnvironment,
    now,
  });
  if (attempt.duplicate) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  const { eventRowId } = attempt;
  const finish = async (
    processingError: string | null = null,
    scrubUserId = false
  ) => {
    await finishWebhookEvent(
      database,
      eventRowId,
      event,
      now,
      processingError,
      scrubUserId
    );
  };
  const fail = async (error: unknown) => {
    await failWebhookEvent(database, eventRowId, now, error);
  };

  if (isInformationalRevenueCatEvent(event.type)) {
    await finish('informational_event', true);
    return NextResponse.json({ received: true });
  }

  try {
    let eventEnvironment = event.environment?.toLowerCase();
    if (!eventEnvironment) {
      const mayInferEnvironment =
        process.env.REVENUECAT_INFER_MISSING_EVENT_ENVIRONMENT === 'true' &&
        (event.type === 'TRANSFER' || event.type === 'PURCHASE_REDEEMED');
      if (!mayInferEnvironment) {
        // Some valid ownership events omit this field. Keep the row retryable
        // until the operator confirms environment-filtered integrations and
        // enables inference; never guess merely from the deployment name.
        throw new Error('missing_event_environment');
      }
      eventEnvironment = billingEnvironment;
    } else if (
      eventEnvironment !== 'sandbox' &&
      eventEnvironment !== 'production'
    ) {
      throw new Error('invalid_event_environment');
    }
    if (eventEnvironment !== billingEnvironment) {
      await finish(`environment_ignored:${eventEnvironment}`, true);
      return NextResponse.json({ received: true });
    }

    if (event.type === 'PURCHASE_REDEEMED') {
      if (!event.redemption_outcome) {
        throw new Error('missing_redemption_outcome');
      }
      if (event.redemption_outcome === 'transfer') {
        // RevenueCat sends a paired TRANSFER for this outcome. Only that event
        // may move ownership, and Kallo default-denies transfers while restore
        // behavior is Keep original.
        await finish('redemption_transfer_deferred', true);
        return NextResponse.json({ received: true });
      }
    }

    if (candidates.length === 0) {
      throw new Error(
        event.type === 'PURCHASE_REDEEMED'
          ? 'unresolvable_redemption_destination'
          : 'unresolvable_user'
      );
    }

    const authoritativeEventAt = new Date(event.event_timestamp_ms);
    const authoritativeEventPriority = event.type === 'TRANSFER' ? 100 : 10;

    if (event.type === 'TRANSFER') {
      // RevenueCat receipt transfers are an account-ownership operation, not a
      // normal lifecycle update. Default deny so a mutable dashboard setting
      // cannot let account B steal account A's access. Keep-original restore is
      // the supported policy; enabling this requires a separately reviewed
      // ownership-transfer workflow.
      if (process.env.REVENUECAT_ALLOW_OWNERSHIP_TRANSFER !== 'true') {
        throw new Error('ownership_transfer_disabled');
      }
      const destinationCandidates = uniqueUuidCandidates(
        event.transferred_to ?? []
      );
      if (destinationCandidates.length === 0) {
        throw new Error('unresolvable_transfer_destination');
      }
      const destinationIds = await existingUserIds(
        database,
        destinationCandidates
      );
      if (destinationIds.length === 0) {
        await finish('orphaned_user', true);
        return NextResponse.json({ received: true });
      }
      if (destinationIds.length > 1) {
        throw new Error('ambiguous_transfer_destination');
      }

      const destinationId = destinationIds[0] as string;
      const sourceIds = (
        await existingUserIds(
          database,
          uniqueUuidCandidates(event.transferred_from ?? [])
        )
      ).filter((userId) => userId !== destinationId);
      const destinationSnapshot = await fetchSnapshot(
        destinationId,
        billingEnvironment
      );
      await reconcileRevenueCatGrantSnapshots(
        [{ userId: destinationId, snapshot: destinationSnapshot }],
        {
          db: database,
          now: () => now,
          authoritativeEventAt,
          authoritativeEventId: event.id,
          authoritativeEventPriority,
          allowOwnershipTransfer: true,
          revocations: sourceIds.map((userId) => ({
            userId,
            environment: billingEnvironment,
            // Local receipt order is the reconciliation watermark. The
            // provider event clock is retained separately as the tombstone.
            providerSyncedAt: now,
            tombstoneAt: authoritativeEventAt,
          })),
        }
      );
    } else {
      const preferredCandidates = preferredIdentityCandidates(event);
      if (
        event.type === 'PURCHASE_REDEEMED' &&
        preferredCandidates.length !== 1
      ) {
        throw new Error('unresolvable_redemption_destination');
      }
      const preferredIds = await existingUserIds(database, preferredCandidates);
      if (event.type === 'PURCHASE_REDEEMED' && preferredIds.length !== 1) {
        throw new Error('unresolvable_redemption_destination');
      }
      const fallbackIds =
        event.type === 'PURCHASE_REDEEMED'
          ? []
          : await existingUserIds(database, candidates);
      const resolvedIds = preferredIds.length > 0 ? preferredIds : fallbackIds;
      if (resolvedIds.length === 0) {
        await finish('orphaned_user', true);
        return NextResponse.json({ received: true });
      }
      if (resolvedIds.length > 1) {
        throw new Error('ambiguous_user');
      }

      const userId = resolvedIds[0] as string;
      const snapshot = await fetchSnapshot(userId, billingEnvironment);
      await reconcileRevenueCatGrantSnapshots([{ userId, snapshot }], {
        db: database,
        now: () => now,
        authoritativeEventAt,
        authoritativeEventId: event.id,
        authoritativeEventPriority,
      });
    }

    await finish();
    return NextResponse.json({ received: true });
  } catch (error) {
    try {
      await fail(error);
    } catch {
      // Returning 500 remains the most important recovery signal if even the
      // audit-row update failed.
    }
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }
}
