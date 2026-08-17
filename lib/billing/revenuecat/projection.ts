import { and, eq, isNull, lte, or } from 'drizzle-orm';
import { advanceRevenueCatWatermark } from '@/lib/billing/revenuecat/ownership';
import type { RevenueCatSnapshot } from '@/lib/billing/revenuecat/snapshot';
import type { AppDb } from '@/lib/db';
import { billingProviderSyncs, entitlementGrants } from '@/lib/db/schema';

// Project ONE customer's CustomerInfo snapshot onto their `entitlement_grants`
// rows, inside a caller-owned transaction. Everything here is a fail-closed
// gate before the write: a read model is not proof of ownership, an empty
// get-or-create customer is not proof of cancellation, and a stale response
// must never expire a live grant.

type GrantTransaction = Parameters<Parameters<AppDb['transaction']>[0]>[0];

export class RevenueCatOwnershipConflictError extends Error {
  constructor() {
    super('revenuecat_ownership_conflict');
  }
}

export async function reconcileRevenueCatGrantsInTransaction(
  tx: GrantTransaction,
  userId: string,
  snapshot: RevenueCatSnapshot,
  now: Date,
  ownershipClaimed = false,
  allowOwnershipTransfer = false
): Promise<void> {
  const syncRows = await tx
    .select({
      customerMissingSince: billingProviderSyncs.customerMissingSince,
      ownershipRevoked: billingProviderSyncs.ownershipRevoked,
      providerSyncedAt: billingProviderSyncs.providerSyncedAt,
    })
    .from(billingProviderSyncs)
    .where(
      and(
        eq(billingProviderSyncs.userId, userId),
        eq(billingProviderSyncs.source, 'revenuecat'),
        eq(billingProviderSyncs.environment, snapshot.environment)
      )
    )
    .limit(1);
  const customerMissingSince = syncRows[0]?.customerMissingSince ?? null;
  const ownershipRevoked = syncRows[0]?.ownershipRevoked ?? false;

  // CustomerInfo is a read model, not proof of receipt ownership. Once a
  // provider event transfers ownership away, only a newer provider event may
  // reopen the account; background/user-driven snapshots remain read-only.
  if (snapshot.grants.length > 0 && ownershipRevoked && !ownershipClaimed) {
    await advanceRevenueCatWatermark(
      tx,
      {
        userId,
        environment: snapshot.environment,
        providerSyncedAt: snapshot.providerSyncedAt,
      },
      customerMissingSince,
      now
    );
    return;
  }

  // RevenueCat's endpoint is get-or-create: a missing customer is 201 once,
  // then 200/empty on retries. Persist a quarantine latch so the later 200 can
  // never expire a valid grant. A non-empty, transaction-backed snapshot is
  // the only automatic path that clears the latch.
  if (snapshot.grants.length === 0 && snapshot.customerCreated) {
    const existingActiveGrant = await tx
      .select({ id: entitlementGrants.id })
      .from(entitlementGrants)
      .where(
        and(
          eq(entitlementGrants.userId, userId),
          eq(entitlementGrants.source, 'revenuecat'),
          eq(entitlementGrants.environment, snapshot.environment),
          eq(entitlementGrants.status, 'active')
        )
      )
      .limit(1);
    const nextMissingSince =
      existingActiveGrant.length > 0 ? (customerMissingSince ?? now) : null;
    const accepted = ownershipClaimed
      ? await tx
          .update(billingProviderSyncs)
          .set({ customerMissingSince: nextMissingSince, updatedAt: now })
          .where(
            and(
              eq(billingProviderSyncs.userId, userId),
              eq(billingProviderSyncs.source, 'revenuecat'),
              eq(billingProviderSyncs.environment, snapshot.environment)
            )
          )
          .then(() => true)
      : await advanceRevenueCatWatermark(
          tx,
          {
            userId,
            environment: snapshot.environment,
            providerSyncedAt: snapshot.providerSyncedAt,
          },
          nextMissingSince,
          now
        );
    if (accepted && nextMissingSince) {
      console.error(
        `[billing] Quarantined empty RevenueCat customer for ${userId}/${snapshot.environment}.`
      );
    }
    return;
  }

  if (snapshot.grants.length === 0 && customerMissingSince) {
    await advanceRevenueCatWatermark(
      tx,
      {
        userId,
        environment: snapshot.environment,
        providerSyncedAt: snapshot.providerSyncedAt,
      },
      customerMissingSince,
      now
    );
    return;
  }

  const accepted = ownershipClaimed
    ? true
    : await advanceRevenueCatWatermark(
        tx,
        {
          userId,
          environment: snapshot.environment,
          providerSyncedAt: snapshot.providerSyncedAt,
        },
        null,
        now
      );

  // A newer (or identical) snapshot already won. Do not expire or insert
  // any grant from this stale response, including a previously unseen row.
  if (!accepted) return;

  // Account-isolation boundary for non-authoritative reads. A CustomerInfo
  // snapshot is fetched by the caller's app-user-id, so its canonical customer
  // must be the caller. If RevenueCat instead returns a customer owned by a
  // different user (an alias/transfer we have not been told about by an
  // authoritative event), refuse to first-claim or expire any grant from it —
  // only a TRANSFER/purchase webhook may cross the ownership boundary. This
  // stops a caller whose snapshot surfaces another user's receipt from
  // claiming a not-yet-recorded grant before the owner's row exists, and keeps
  // isolation independent of the RevenueCat dashboard restore setting. The
  // watermark above is already advanced, so this is an idempotent no-op.
  if (!ownershipClaimed && snapshot.providerCustomerId !== userId) {
    return;
  }

  const notNewer = or(
    isNull(entitlementGrants.providerSyncedAt),
    lte(entitlementGrants.providerSyncedAt, snapshot.providerSyncedAt)
  );
  const sameOwnerOrExplicitTransfer = allowOwnershipTransfer
    ? notNewer
    : and(eq(entitlementGrants.userId, userId), notNewer);

  await tx
    .update(entitlementGrants)
    .set({
      status: 'expired',
      willRenew: false,
      managementUrl: null,
      providerSyncedAt: snapshot.providerSyncedAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(entitlementGrants.userId, userId),
        eq(entitlementGrants.source, 'revenuecat'),
        eq(entitlementGrants.environment, snapshot.environment),
        notNewer
      )
    );

  for (const grant of snapshot.grants) {
    const conflictSet = {
      ...(allowOwnershipTransfer ? { userId } : {}),
      entitlementKey: grant.entitlementKey,
      store: grant.store,
      productId: grant.productId,
      startsAt: grant.startsAt,
      expiresAt: grant.expiresAt,
      status: 'active' as const,
      willRenew: grant.willRenew,
      providerSyncedAt: snapshot.providerSyncedAt,
      managementUrl: grant.managementUrl,
      updatedAt: now,
    };
    const applied = await tx
      .insert(entitlementGrants)
      .values({
        userId,
        entitlementKey: grant.entitlementKey,
        source: 'revenuecat',
        environment: snapshot.environment,
        store: grant.store,
        productId: grant.productId,
        startsAt: grant.startsAt,
        expiresAt: grant.expiresAt,
        status: 'active',
        willRenew: grant.willRenew,
        externalRef: grant.externalRef,
        providerSyncedAt: snapshot.providerSyncedAt,
        managementUrl: grant.managementUrl,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          entitlementGrants.source,
          entitlementGrants.externalRef,
          entitlementGrants.environment,
        ],
        set: conflictSet,
        // A CustomerInfo snapshot is not proof that a receipt moved between
        // app users. Only an authoritative TRANSFER/REDEMPTION event may
        // update a unique external reference already owned by another user.
        setWhere: sameOwnerOrExplicitTransfer,
      })
      .returning({ userId: entitlementGrants.userId });
    if (applied.length === 0) {
      throw new RevenueCatOwnershipConflictError();
    }
  }
}
