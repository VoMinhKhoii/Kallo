import type { BillingEnvironment } from '@/lib/domain/billing/revenuecat/identity';
import { reconcileRevenueCatGrantSnapshots } from '@/lib/domain/billing/revenuecat/reconciliation';
import type { RevenueCatSnapshot } from '@/lib/domain/billing/revenuecat/snapshot';
import {
  existingUserIds,
  preferredIdentityCandidates,
  uniqueUuidCandidates,
} from '@/lib/domain/billing/revenuecat/webhook/candidates';
import type { RevenueCatEvent } from '@/lib/domain/billing/revenuecat/webhook/parse';
import type { AppDb } from '@/lib/infra/db';

// What one authenticated, recorded event does to the grant side. The webhook
// never reconstructs lifecycle state from the event's own fields: it decides
// WHO the event is about, then replaces that customer's projection from a
// freshly fetched CustomerInfo snapshot.

export type RevenueCatSnapshotFetcher = (
  appUserId: string,
  billingEnvironment: BillingEnvironment
) => Promise<RevenueCatSnapshot>;

export interface RevenueCatWebhookReconcileInput {
  event: RevenueCatEvent;
  /** Identity candidates already derived from the event, in preference order. */
  candidates: string[];
  billingEnvironment: BillingEnvironment;
  database: AppDb;
  now: Date;
  fetchSnapshot: RevenueCatSnapshotFetcher;
}

/**
 * `processed` means grants were reconciled. `skipped` carries the audit reason
 * for an event we finalize deliberately without touching grants. Everything
 * else throws: the caller records the message, and `failWebhookEvent` decides
 * whether that message is retryable or permanent.
 */
export type RevenueCatWebhookOutcome =
  | { kind: 'processed' }
  | { kind: 'skipped'; reason: string };

interface BranchInput extends RevenueCatWebhookReconcileInput {
  authoritativeEventAt: Date;
  authoritativeEventPriority: number;
}

export async function reconcileRevenueCatWebhookEvent(
  input: RevenueCatWebhookReconcileInput
): Promise<RevenueCatWebhookOutcome> {
  const { event, candidates, billingEnvironment } = input;

  const environmentGate = resolveEventEnvironment(event, billingEnvironment);
  if (environmentGate !== billingEnvironment) {
    return {
      kind: 'skipped',
      reason: `environment_ignored:${environmentGate}`,
    };
  }

  if (event.type === 'PURCHASE_REDEEMED') {
    if (!event.redemption_outcome) {
      throw new Error('missing_redemption_outcome');
    }
    if (event.redemption_outcome === 'transfer') {
      // RevenueCat sends a paired TRANSFER for this outcome. Only that event
      // may move ownership, and Kallo default-denies transfers while restore
      // behavior is Keep original.
      return { kind: 'skipped', reason: 'redemption_transfer_deferred' };
    }
  }

  if (candidates.length === 0) {
    throw new Error(
      event.type === 'PURCHASE_REDEEMED'
        ? 'unresolvable_redemption_destination'
        : 'unresolvable_user'
    );
  }

  const branch: BranchInput = {
    ...input,
    authoritativeEventAt: new Date(event.event_timestamp_ms),
    authoritativeEventPriority: event.type === 'TRANSFER' ? 100 : 10,
  };
  return event.type === 'TRANSFER'
    ? reconcileTransfer(branch)
    : reconcileLifecycle(branch);
}

/** The event's own environment, normalized. Throws when it cannot be trusted. */
function resolveEventEnvironment(
  event: RevenueCatEvent,
  billingEnvironment: BillingEnvironment
): string {
  const eventEnvironment = event.environment?.toLowerCase();
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
    return billingEnvironment;
  }
  if (eventEnvironment !== 'sandbox' && eventEnvironment !== 'production') {
    throw new Error('invalid_event_environment');
  }
  return eventEnvironment;
}

async function reconcileTransfer({
  event,
  billingEnvironment,
  database,
  now,
  fetchSnapshot,
  authoritativeEventAt,
  authoritativeEventPriority,
}: BranchInput): Promise<RevenueCatWebhookOutcome> {
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
  const destinationIds = await existingUserIds(database, destinationCandidates);
  if (destinationIds.length === 0) {
    return { kind: 'skipped', reason: 'orphaned_user' };
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
  return { kind: 'processed' };
}

async function reconcileLifecycle({
  event,
  candidates,
  billingEnvironment,
  database,
  now,
  fetchSnapshot,
  authoritativeEventAt,
  authoritativeEventPriority,
}: BranchInput): Promise<RevenueCatWebhookOutcome> {
  const preferredCandidates = preferredIdentityCandidates(event);
  if (event.type === 'PURCHASE_REDEEMED' && preferredCandidates.length !== 1) {
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
    return { kind: 'skipped', reason: 'orphaned_user' };
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
  return { kind: 'processed' };
}
