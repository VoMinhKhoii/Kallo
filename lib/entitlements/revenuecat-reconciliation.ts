import { and, eq, isNull, lt, lte, or } from 'drizzle-orm';
import type { RevenueCatSnapshot } from '@/lib/billing/revenuecat';
import type { AppDb } from '@/lib/db';
import { db as appDb } from '@/lib/db';
import { billingProviderSyncs, entitlementGrants } from '@/lib/db/schema';
import type {
  RevenueCatCustomerRevocation,
  RevenueCatGrantReconciliation,
  RevenueCatReconciliationDeps,
} from '@/lib/entitlements/grants';
import {
  claimRevenueCatOwnershipEvent,
  StaleOwnershipEventError,
} from '@/lib/entitlements/revenuecat-ownership';

type GrantTransaction = Parameters<Parameters<AppDb['transaction']>[0]>[0];

export class RevenueCatOwnershipConflictError extends Error {
  constructor() {
    super('revenuecat_ownership_conflict');
  }
}

export async function reconcileRevenueCatGrantSnapshotsInternal(
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

async function advanceRevenueCatWatermark(
  tx: GrantTransaction,
  input: RevenueCatCustomerRevocation,
  customerMissingSince: Date | null,
  now: Date
): Promise<boolean> {
  const accepted = await tx
    .insert(billingProviderSyncs)
    .values({
      userId: input.userId,
      source: 'revenuecat',
      environment: input.environment,
      providerSyncedAt: input.providerSyncedAt,
      customerMissingSince,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        billingProviderSyncs.userId,
        billingProviderSyncs.source,
        billingProviderSyncs.environment,
      ],
      set: {
        providerSyncedAt: input.providerSyncedAt,
        customerMissingSince,
        updatedAt: now,
      },
      setWhere: lt(
        billingProviderSyncs.providerSyncedAt,
        input.providerSyncedAt
      ),
    })
    .returning({ id: billingProviderSyncs.id });

  return accepted.length > 0;
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

async function reconcileRevenueCatGrantsInTransaction(
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
