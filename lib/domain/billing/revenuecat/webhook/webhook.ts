import { NextResponse } from 'next/server';
import { fetchRevenueCatSnapshot } from '@/lib/domain/billing/revenuecat/client';
import {
  type BillingEnvironment,
  getBillingEnvironment,
} from '@/lib/domain/billing/revenuecat/identity';
import {
  authenticateRevenueCatRequest,
  checkRevenueCatAppAllowed,
} from '@/lib/domain/billing/revenuecat/webhook/authenticate';
import { identityCandidates } from '@/lib/domain/billing/revenuecat/webhook/candidates';
import {
  failWebhookEvent,
  finishWebhookEvent,
  recordWebhookAttempt,
} from '@/lib/domain/billing/revenuecat/webhook/event-store';
import {
  isInformationalRevenueCatEvent,
  parseRevenueCatWebhookBody,
} from '@/lib/domain/billing/revenuecat/webhook/parse';
import {
  type RevenueCatSnapshotFetcher,
  reconcileRevenueCatWebhookEvent,
} from '@/lib/domain/billing/revenuecat/webhook/reconcile';
import { type AppDb, db as appDb } from '@/lib/infra/db/client';

/**
 * The public entry of the RevenueCat webhook module: authenticate, parse,
 * record, reconcile, finalize. The four collaborators below are the module's
 * only non-deterministic edges — the clock, the database, the deployment's
 * billing environment, and the CustomerInfo fetch. They are injectable so the
 * end-to-end contract (status codes AND the audit row each path leaves behind)
 * can be exercised against an in-memory database without module mocking.
 */
export interface RevenueCatWebhookDeps {
  db?: AppDb;
  now?: () => Date;
  billingEnvironment?: BillingEnvironment;
  fetchSnapshot?: RevenueCatSnapshotFetcher;
}

export async function handleRevenueCatWebhook(
  request: Request,
  deps?: RevenueCatWebhookDeps
) {
  const database = deps?.db ?? appDb;
  const now = deps?.now?.() ?? new Date();
  const fetchSnapshot =
    deps?.fetchSnapshot ??
    ((appUserId: string, billingEnvironment: BillingEnvironment) =>
      fetchRevenueCatSnapshot(appUserId, { billingEnvironment }));

  const authenticated = await authenticateRevenueCatRequest(request, now);
  if (!authenticated.ok) {
    const { status, error } = authenticated.failure;
    return NextResponse.json({ error }, { status });
  }

  const parsed = parseRevenueCatWebhookBody(authenticated.rawBody);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, detail: parsed.detail },
      { status: 400 }
    );
  }

  const body = parsed.body;
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

  const appFailure = checkRevenueCatAppAllowed(event);
  if (appFailure) {
    return NextResponse.json(
      { error: appFailure.error },
      { status: appFailure.status }
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
  const finish = (processingError: string | null = null, scrubUserId = false) =>
    finishWebhookEvent(
      database,
      eventRowId,
      event,
      now,
      processingError,
      scrubUserId
    );

  if (isInformationalRevenueCatEvent(event.type)) {
    await finish('informational_event', true);
    return NextResponse.json({ received: true });
  }

  try {
    const outcome = await reconcileRevenueCatWebhookEvent({
      event,
      candidates,
      billingEnvironment,
      database,
      now,
      fetchSnapshot,
    });
    await (outcome.kind === 'skipped'
      ? finish(outcome.reason, true)
      : finish());
    return NextResponse.json({ received: true });
  } catch (error) {
    try {
      await failWebhookEvent(database, eventRowId, now, error);
    } catch {
      // Returning 500 remains the most important recovery signal if even the
      // audit-row update failed.
    }
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }
}
