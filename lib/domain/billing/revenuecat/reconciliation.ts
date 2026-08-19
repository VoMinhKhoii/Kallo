import { and, eq } from 'drizzle-orm';
import type { GrantMutationDeps } from '@/lib/domain/billing/entitlement/grants';
import type { BillingEnvironment } from '@/lib/domain/billing/revenuecat/identity';
import {
  claimRevenueCatOwnershipEvent,
  StaleOwnershipEventError,
} from '@/lib/domain/billing/revenuecat/ownership';
import { reconcileRevenueCatGrantsInTransaction } from '@/lib/domain/billing/revenuecat/projection';
import type { RevenueCatSnapshot } from '@/lib/domain/billing/revenuecat/snapshot';
import { type AppDb, db as appDb } from '@/lib/infra/db/client';
import { entitlementGrants } from '@/lib/infra/db/schema';

// Where the purchase side hands off to the grant side: replace a set of
// RevenueCat customers' projections in ONE transaction. Transfer webhooks move
// access between several App User IDs at once, so every participant's ownership
// claim is taken before any grant row moves — a partial transfer is worse than
// no transfer.

type GrantTransaction = Parameters<Parameters<AppDb['transaction']>[0]>[0];

export interface RevenueCatCustomerRevocation {
  userId: string;
  environment: BillingEnvironment;
  providerSyncedAt: Date;
  /** Provider event time retained as the ownership-revocation tombstone. */
  tombstoneAt?: Date;
}

export interface RevenueCatReconciliationDeps extends GrantMutationDeps {
  revocations?: RevenueCatCustomerRevocation[];
  /** Only authoritative provider events may clear a transfer tombstone. */
  authoritativeEventAt?: Date;
  authoritativeEventId?: string;
  authoritativeEventPriority?: number;
  /** Ownership changes are restricted to the explicit TRANSFER path. */
  allowOwnershipTransfer?: boolean;
}

export interface RevenueCatGrantReconciliation {
  userId: string;
  snapshot: RevenueCatSnapshot;
}

/**
 * Atomically replace one user's RevenueCat projection with a canonical
 * CustomerInfo snapshot. `providerSyncedAt` makes the write monotonic: a slow
 * response from an older concurrent reconciliation cannot overwrite newer
 * provider state.
 */
export async function reconcileRevenueCatGrants(
  userId: string,
  snapshot: RevenueCatSnapshot,
  deps?: RevenueCatReconciliationDeps
): Promise<void> {
  await reconcileRevenueCatGrantSnapshots([{ userId, snapshot }], deps);
}

/**
 * Reconcile every affected RevenueCat customer in one database transaction.
 * Transfer webhooks can move access between multiple App User IDs; committing
 * those projections independently would allow a partial transfer if one write
 * failed after another had already committed.
 */
export async function reconcileRevenueCatGrantSnapshots(
  reconciliations: RevenueCatGrantReconciliation[],
  deps?: RevenueCatReconciliationDeps
): Promise<void> {
  if (reconciliations.length === 0 && !deps?.revocations?.length) return;

  const database = deps?.db ?? appDb;
  const now = deps?.now?.() ?? new Date();

  try {
    await database.transaction(async (tx) => {
      // Ownership events use RevenueCat's event clock, which is intentionally
      // independent from CustomerInfo.request_date. Claim every participant
      // before changing a grant: if even one source/destination has already
      // seen a newer event, throwing rolls the whole transfer back.
      for (const revocation of deps?.revocations ?? []) {
        const accepted = await claimRevenueCatOwnershipEvent(
          tx,
          {
            userId: revocation.userId,
            environment: revocation.environment,
            providerSyncedAt: revocation.providerSyncedAt,
            eventAt: revocation.tombstoneAt ?? now,
            eventId:
              deps?.authoritativeEventId ??
              `legacy:${(revocation.tombstoneAt ?? now).toISOString()}`,
            eventPriority: deps?.authoritativeEventPriority ?? 0,
            revoked: true,
          },
          now
        );
        if (!accepted) throw new StaleOwnershipEventError();
      }

      if (deps?.authoritativeEventAt) {
        for (const { userId, snapshot } of reconciliations) {
          const accepted = await claimRevenueCatOwnershipEvent(
            tx,
            {
              userId,
              environment: snapshot.environment,
              providerSyncedAt: snapshot.providerSyncedAt,
              eventAt: deps.authoritativeEventAt,
              eventId:
                deps.authoritativeEventId ??
                `legacy:${deps.authoritativeEventAt.toISOString()}`,
              eventPriority: deps.authoritativeEventPriority ?? 0,
              revoked: false,
            },
            now
          );
          if (!accepted) throw new StaleOwnershipEventError();
        }
      }

      for (const revocation of deps?.revocations ?? []) {
        await revokeRevenueCatCustomerInTransaction(tx, revocation, now);
      }
      for (const { userId, snapshot } of reconciliations) {
        await reconcileRevenueCatGrantsInTransaction(
          tx,
          userId,
          snapshot,
          now,
          Boolean(deps?.authoritativeEventAt),
          deps?.allowOwnershipTransfer
        );
      }
    });
  } catch (error) {
    // A delayed provider event is an idempotent no-op, not a processing
    // failure. The transaction has already rolled back every ownership claim.
    if (error instanceof StaleOwnershipEventError) return;
    throw error;
  }
}

async function revokeRevenueCatCustomerInTransaction(
  tx: GrantTransaction,
  revocation: RevenueCatCustomerRevocation,
  now: Date
): Promise<void> {
  await tx
    .update(entitlementGrants)
    .set({
      status: 'expired',
      willRenew: false,
      managementUrl: null,
      providerSyncedAt: revocation.providerSyncedAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(entitlementGrants.userId, revocation.userId),
        eq(entitlementGrants.source, 'revenuecat'),
        eq(entitlementGrants.environment, revocation.environment)
      )
    );
}
