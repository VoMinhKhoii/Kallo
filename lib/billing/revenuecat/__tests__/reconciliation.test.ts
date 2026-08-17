import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import type { AppDb } from '@/lib/db';
import { billingProviderSyncs, entitlementGrants } from '@/lib/db/schema';
import {
  reconcileRevenueCatGrantSnapshots,
  reconcileRevenueCatGrants,
} from '../reconciliation';

const userId = '11111111-1111-1111-1111-111111111111';
const fixedNow = new Date('2026-06-01T00:00:00.000Z');
const now = () => fixedNow;

interface CustomerQuarantineState {
  hasActiveGrant: boolean;
  customerMissingSince: Date | null;
  ownershipEventAt?: Date | null;
  ownershipEventId?: string | null;
  ownershipEventPriority?: number;
  ownershipRevoked?: boolean;
  providerSyncedAt: Date | null;
  destructiveGrantUpdates: number;
  grantConflictSet?: Record<string, unknown>;
  grantConflictWhere?: unknown;
  lastGrantUpdateSet?: Record<string, unknown>;
}

// In-memory stand-in for the one transaction the reconciliation opens. It
// models the two rows that decide the outcome — the billing_provider_syncs
// watermark/ownership row and whether an active grant already exists — so the
// ordering rules can be asserted without a database.
function makeCustomerQuarantineDb(state: CustomerQuarantineState): AppDb {
  const transactionClient = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: () => {
            if (table === billingProviderSyncs) {
              return Promise.resolve(
                state.providerSyncedAt
                  ? [
                      {
                        customerMissingSince: state.customerMissingSince,
                        ownershipEventAt: state.ownershipEventAt ?? null,
                        ownershipEventId: state.ownershipEventId ?? null,
                        ownershipEventPriority:
                          state.ownershipEventPriority ?? 0,
                        ownershipRevoked: state.ownershipRevoked ?? false,
                        providerSyncedAt: state.providerSyncedAt,
                      },
                    ]
                  : []
              );
            }
            if (table === entitlementGrants) {
              return Promise.resolve(
                state.hasActiveGrant ? [{ id: 'active-grant' }] : []
              );
            }
            return Promise.resolve([]);
          },
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: (config: {
          set: Record<string, unknown>;
          setWhere?: unknown;
        }) => {
          if (table === entitlementGrants) {
            state.grantConflictSet = config.set;
            state.grantConflictWhere = config.setWhere;
            return {
              returning: () =>
                Promise.resolve([{ userId: values.userId as string }]),
            };
          }
          const incomingOwnershipEventAt = values.ownershipEventAt as
            | Date
            | undefined;
          if (incomingOwnershipEventAt) {
            const incomingEventId = values.ownershipEventId as string;
            const incomingPriority = values.ownershipEventPriority as number;
            const currentTime = state.ownershipEventAt?.getTime();
            const incomingTime = incomingOwnershipEventAt.getTime();
            const accepted =
              currentTime == null ||
              currentTime < incomingTime ||
              (currentTime === incomingTime &&
                (state.ownershipEventPriority ?? 0) < incomingPriority) ||
              (currentTime === incomingTime &&
                (state.ownershipEventPriority ?? 0) === incomingPriority &&
                (state.ownershipEventId ?? '') < incomingEventId);
            if (!accepted) {
              return {
                returning: () => Promise.resolve([]),
              };
            }
            state.providerSyncedAt = state.providerSyncedAt
              ? new Date(
                  Math.max(
                    state.providerSyncedAt.getTime(),
                    (values.providerSyncedAt as Date).getTime()
                  )
                )
              : (values.providerSyncedAt as Date);
            state.ownershipEventAt = incomingOwnershipEventAt;
            state.ownershipEventId = incomingEventId;
            state.ownershipEventPriority = incomingPriority;
            state.ownershipRevoked = values.ownershipRevoked as boolean;
            state.customerMissingSince = null;
            return {
              returning: () => Promise.resolve([{ id: 'provider-sync' }]),
            };
          }
          const incomingProviderSyncedAt = values.providerSyncedAt as Date;
          const accepted =
            config.setWhere === undefined ||
            state.providerSyncedAt === null ||
            state.providerSyncedAt.getTime() <
              incomingProviderSyncedAt.getTime();
          if (!accepted) {
            return {
              returning: () => Promise.resolve([]),
            };
          }
          if (
            state.providerSyncedAt === null ||
            state.providerSyncedAt.getTime() <
              incomingProviderSyncedAt.getTime()
          ) {
            state.providerSyncedAt = incomingProviderSyncedAt;
          }
          state.customerMissingSince = (config.set.customerMissingSince ??
            values.customerMissingSince) as Date | null;
          return {
            returning: () => Promise.resolve([{ id: 'provider-sync' }]),
          };
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          if (table === entitlementGrants) {
            state.destructiveGrantUpdates += 1;
            state.lastGrantUpdateSet = values;
          } else if (table === billingProviderSyncs) {
            state.customerMissingSince =
              values.customerMissingSince as Date | null;
          }
          return Promise.resolve();
        },
      }),
    }),
  };

  return {
    transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(transactionClient),
  } as unknown as AppDb;
}

describe('reconcileRevenueCatGrants', () => {
  const newlyCreatedEmptyCustomer = {
    providerSyncedAt: fixedNow,
    environment: 'production' as const,
    providerCustomerId: userId,
    customerCreated: true,
    grants: [],
  };

  it('persists quarantine across 201 then 200 empty retries', async () => {
    const state: CustomerQuarantineState = {
      hasActiveGrant: true,
      customerMissingSince: null,
      providerSyncedAt: null,
      destructiveGrantUpdates: 0,
    };
    const database = makeCustomerQuarantineDb(state);

    await reconcileRevenueCatGrants(userId, newlyCreatedEmptyCustomer, {
      db: database,
      now,
    });
    expect(state.customerMissingSince).toEqual(fixedNow);

    await reconcileRevenueCatGrants(
      userId,
      { ...newlyCreatedEmptyCustomer, customerCreated: false },
      { db: database, now }
    );
    expect(state.hasActiveGrant).toBe(true);
    expect(state.destructiveGrantUpdates).toBe(0);
  });

  it('no-ops a newly created empty customer for a truly new user', async () => {
    await expect(
      reconcileRevenueCatGrants(userId, newlyCreatedEmptyCustomer, {
        db: makeCustomerQuarantineDb({
          hasActiveGrant: false,
          customerMissingSince: null,
          providerSyncedAt: null,
          destructiveGrantUpdates: 0,
        }),
        now,
      })
    ).resolves.toBeUndefined();
  });

  it('clears quarantine only after a non-empty trusted snapshot', async () => {
    const state: CustomerQuarantineState = {
      hasActiveGrant: true,
      customerMissingSince: fixedNow,
      providerSyncedAt: fixedNow,
      destructiveGrantUpdates: 0,
    };
    const snapshot = {
      providerSyncedAt: new Date('2026-06-02T00:00:00.000Z'),
      environment: 'production' as const,
      providerCustomerId: userId,
      grants: [
        {
          entitlementKey: 'premium' as const,
          externalRef: `customer:${userId}:premium`,
          productId: 'kallo_premium_monthly',
          store: 'app_store',
          startsAt: fixedNow,
          expiresAt: new Date('2026-07-01T00:00:00.000Z'),
          willRenew: true,
          managementUrl: null,
        },
      ],
    };

    await reconcileRevenueCatGrants(userId, snapshot, {
      db: makeCustomerQuarantineDb(state),
      now,
    });
    expect(state.customerMissingSince).toBeNull();
    expect(state.destructiveGrantUpdates).toBe(1);
  });

  it('does not let a stale 201 snapshot set quarantine after newer state', async () => {
    const newer = new Date('2026-06-03T00:00:00.000Z');
    const state: CustomerQuarantineState = {
      hasActiveGrant: true,
      customerMissingSince: null,
      providerSyncedAt: newer,
      destructiveGrantUpdates: 0,
    };

    await reconcileRevenueCatGrants(userId, newlyCreatedEmptyCustomer, {
      db: makeCustomerQuarantineDb(state),
      now,
    });

    expect(state.providerSyncedAt).toEqual(newer);
    expect(state.customerMissingSince).toBeNull();
    expect(state.destructiveGrantUpdates).toBe(0);
  });

  it('advances the watermark but preserves quarantine on a newer empty retry', async () => {
    const missingSince = new Date('2026-06-01T00:00:00.000Z');
    const state: CustomerQuarantineState = {
      hasActiveGrant: true,
      customerMissingSince: missingSince,
      providerSyncedAt: fixedNow,
      destructiveGrantUpdates: 0,
    };
    const newer = new Date('2026-06-02T00:00:00.000Z');

    await reconcileRevenueCatGrants(
      userId,
      {
        providerSyncedAt: newer,
        environment: 'production',
        providerCustomerId: userId,
        customerCreated: false,
        grants: [],
      },
      { db: makeCustomerQuarantineDb(state), now }
    );

    expect(state.providerSyncedAt).toEqual(newer);
    expect(state.customerMissingSince).toEqual(missingSince);
    expect(state.destructiveGrantUpdates).toBe(0);
  });

  it('does not move grant ownership during ordinary reconciliation', async () => {
    const state: CustomerQuarantineState = {
      hasActiveGrant: false,
      customerMissingSince: null,
      providerSyncedAt: null,
      destructiveGrantUpdates: 0,
    };
    const snapshot = {
      providerSyncedAt: new Date('2026-06-02T00:00:00.000Z'),
      environment: 'production' as const,
      providerCustomerId: userId,
      grants: [
        {
          entitlementKey: 'premium' as const,
          externalRef: `customer:${userId}:premium`,
          productId: 'kallo_premium_monthly',
          store: 'app_store',
          startsAt: fixedNow,
          expiresAt: new Date('2026-07-01T00:00:00.000Z'),
          willRenew: true,
          managementUrl: null,
        },
      ],
    };

    await reconcileRevenueCatGrants(userId, snapshot, {
      db: makeCustomerQuarantineDb(state),
      now,
    });

    expect(state.grantConflictSet).not.toHaveProperty('userId');
    const query = new PgDialect().sqlToQuery(state.grantConflictWhere as SQL);
    expect(query.sql).toContain('"entitlement_grants"."user_id" = $1');
    expect(query.params).toContain(userId);
  });

  it('does not first-claim a foreign customer grant on non-authoritative reconciliation', async () => {
    // The snapshot's canonical RevenueCat customer is a DIFFERENT user than the
    // caller (e.g. another account's receipt surfaced in this lookup). Without
    // an authoritative TRANSFER/purchase event, ordinary reconciliation must
    // neither insert nor expire any grant — otherwise the caller could claim a
    // grant whose owning row does not exist yet, before the real owner's row is
    // recorded. This isolation must not depend on the RevenueCat dashboard
    // "Keep with original App User ID" setting.
    const state: CustomerQuarantineState = {
      hasActiveGrant: false,
      customerMissingSince: null,
      providerSyncedAt: null,
      destructiveGrantUpdates: 0,
    };
    const snapshot = {
      providerSyncedAt: new Date('2026-06-02T00:00:00.000Z'),
      environment: 'production' as const,
      providerCustomerId: 'original-owner',
      grants: [
        {
          entitlementKey: 'premium' as const,
          externalRef: 'customer:original-owner:premium',
          productId: 'kallo_premium_monthly',
          store: 'app_store',
          startsAt: fixedNow,
          expiresAt: new Date('2026-07-01T00:00:00.000Z'),
          willRenew: true,
          managementUrl: null,
        },
      ],
    };

    await reconcileRevenueCatGrants(userId, snapshot, {
      db: makeCustomerQuarantineDb(state),
      now,
    });

    // No grant insert (conflict set never captured) and no destructive update.
    expect(state.grantConflictSet).toBeUndefined();
    expect(state.destructiveGrantUpdates).toBe(0);
    // The provider watermark still advances so the read is not reprocessed.
    expect(state.providerSyncedAt).toEqual(
      new Date('2026-06-02T00:00:00.000Z')
    );
  });

  it('allows ownership movement only for an explicit transfer', async () => {
    const state: CustomerQuarantineState = {
      hasActiveGrant: false,
      customerMissingSince: null,
      providerSyncedAt: null,
      destructiveGrantUpdates: 0,
    };

    await reconcileRevenueCatGrants(
      userId,
      {
        providerSyncedAt: new Date('2026-06-02T00:00:00.000Z'),
        environment: 'production',
        providerCustomerId: 'original-owner',
        grants: [
          {
            entitlementKey: 'premium',
            externalRef: 'customer:original-owner:premium',
            productId: 'kallo_premium_monthly',
            store: 'app_store',
            startsAt: fixedNow,
            expiresAt: new Date('2026-07-01T00:00:00.000Z'),
            willRenew: true,
            managementUrl: null,
          },
        ],
      },
      {
        db: makeCustomerQuarantineDb(state),
        now,
        authoritativeEventAt: fixedNow,
        allowOwnershipTransfer: true,
      }
    );

    expect(state.grantConflictSet?.userId).toBe(userId);
    const query = new PgDialect().sqlToQuery(state.grantConflictWhere as SQL);
    expect(query.sql).not.toContain('"entitlement_grants"."user_id"');
    expect(query.params).not.toContain(userId);
  });

  it('keeps revoked ownership closed to ordinary newer snapshots', async () => {
    const ownershipEventAt = new Date('2026-06-02T00:00:00.000Z');
    const state: CustomerQuarantineState = {
      hasActiveGrant: false,
      customerMissingSince: null,
      ownershipEventAt,
      ownershipRevoked: true,
      providerSyncedAt: fixedNow,
      destructiveGrantUpdates: 0,
    };

    await reconcileRevenueCatGrants(
      userId,
      {
        providerSyncedAt: new Date('2026-06-03T00:00:00.000Z'),
        environment: 'production',
        providerCustomerId: userId,
        grants: [
          {
            entitlementKey: 'premium',
            externalRef: `customer:${userId}:premium`,
            productId: 'kallo_premium_monthly',
            store: 'app_store',
            startsAt: fixedNow,
            expiresAt: new Date('2026-07-01T00:00:00.000Z'),
            willRenew: true,
            managementUrl: null,
          },
        ],
      },
      { db: makeCustomerQuarantineDb(state), now }
    );

    expect(state.ownershipEventAt).toEqual(ownershipEventAt);
    expect(state.ownershipRevoked).toBe(true);
    expect(state.destructiveGrantUpdates).toBe(0);
    expect(state.grantConflictSet).toBeUndefined();
  });

  it('forces transfer revocation across a newer snapshot watermark', async () => {
    const tombstoneAt = new Date('2026-06-02T00:00:00.000Z');
    const state: CustomerQuarantineState = {
      hasActiveGrant: true,
      customerMissingSince: null,
      providerSyncedAt: new Date('2026-06-03T00:00:00.000Z'),
      destructiveGrantUpdates: 0,
    };

    await reconcileRevenueCatGrantSnapshots([], {
      db: makeCustomerQuarantineDb(state),
      now,
      revocations: [
        {
          userId,
          environment: 'production',
          providerSyncedAt: fixedNow,
          tombstoneAt,
        },
      ],
    });

    expect(state.customerMissingSince).toBeNull();
    expect(state.ownershipEventAt).toEqual(tombstoneAt);
    expect(state.ownershipRevoked).toBe(true);
    expect(state.destructiveGrantUpdates).toBe(1);
    expect(state.lastGrantUpdateSet).toMatchObject({
      status: 'expired',
      willRenew: false,
    });
  });

  it('ignores a stale transfer after a newer transfer-back', async () => {
    const newerTransferBack = new Date('2026-06-03T00:00:00.000Z');
    const staleTransferAway = new Date('2026-06-02T00:00:00.000Z');
    const state: CustomerQuarantineState = {
      hasActiveGrant: true,
      customerMissingSince: null,
      ownershipEventAt: newerTransferBack,
      ownershipRevoked: false,
      providerSyncedAt: new Date('2026-06-04T00:00:00.000Z'),
      destructiveGrantUpdates: 0,
    };

    await reconcileRevenueCatGrantSnapshots([], {
      db: makeCustomerQuarantineDb(state),
      now,
      revocations: [
        {
          userId,
          environment: 'production',
          providerSyncedAt: fixedNow,
          tombstoneAt: staleTransferAway,
        },
      ],
    });

    expect(state.ownershipEventAt).toEqual(newerTransferBack);
    expect(state.ownershipRevoked).toBe(false);
    expect(state.destructiveGrantUpdates).toBe(0);
  });
});
