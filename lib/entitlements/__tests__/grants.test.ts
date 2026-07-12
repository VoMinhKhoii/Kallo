import { describe, expect, it } from 'vitest';
import type { AppDb } from '@/lib/db';
import {
  markGrantStatus,
  reassignGrants,
  setGrantWillRenew,
  upsertGrant,
} from '../grants';

const userId = '11111111-1111-1111-1111-111111111111';
const fixedNow = new Date('2026-06-01T00:00:00.000Z');
const now = () => fixedNow;

// Captures the fluent Drizzle calls the grant writers make so we can assert
// upsert semantics (onConflictDoUpdate target + set) and update filters at the
// call level, mirroring the DI stub style used in service.test.ts.
interface Captured {
  insertValues?: Record<string, unknown>;
  onConflict?: { target: unknown; set: Record<string, unknown> };
  updateSet?: Record<string, unknown>;
}

function makeDb(captured: Captured): AppDb {
  return {
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        captured.insertValues = values;
        return {
          onConflictDoUpdate: (config: {
            target: unknown;
            set: Record<string, unknown>;
          }) => {
            captured.onConflict = config;
            return Promise.resolve();
          },
        };
      },
    }),
    update: () => ({
      set: (set: Record<string, unknown>) => {
        captured.updateSet = set;
        return {
          where: () => Promise.resolve(),
        };
      },
    }),
  } as unknown as AppDb;
}

describe('upsertGrant', () => {
  it('inserts values and updates on (source, externalRef) conflict', async () => {
    const captured: Captured = {};
    const expiresAt = new Date('2026-07-01T00:00:00.000Z');

    await upsertGrant(
      {
        userId,
        entitlementKey: 'premium',
        source: 'revenuecat',
        productId: 'nham_premium_monthly',
        startsAt: fixedNow,
        expiresAt,
        status: 'active',
        willRenew: true,
        externalRef: 'orig_txn_1',
      },
      { db: makeDb(captured), now }
    );

    expect(captured.insertValues).toMatchObject({
      userId,
      entitlementKey: 'premium',
      source: 'revenuecat',
      productId: 'nham_premium_monthly',
      startsAt: fixedNow,
      expiresAt,
      status: 'active',
      willRenew: true,
      externalRef: 'orig_txn_1',
    });

    // Upsert must target the (source, externalRef) unique constraint and
    // refresh the mutable columns (incl. userId for transfers).
    expect(Array.isArray(captured.onConflict?.target)).toBe(true);
    expect(captured.onConflict?.target).toHaveLength(2);
    expect(captured.onConflict?.set).toMatchObject({
      userId,
      productId: 'nham_premium_monthly',
      startsAt: fixedNow,
      expiresAt,
      status: 'active',
      willRenew: true,
      updatedAt: fixedNow,
    });
    // The conflict update must NOT re-set immutable createdAt.
    expect(captured.onConflict?.set).not.toHaveProperty('createdAt');
  });

  it('carries a null expiresAt through for lifetime grants', async () => {
    const captured: Captured = {};

    await upsertGrant(
      {
        userId,
        entitlementKey: 'premium',
        source: 'revenuecat',
        productId: 'nham_premium_lifetime',
        startsAt: fixedNow,
        expiresAt: null,
        status: 'active',
        willRenew: false,
        externalRef: 'orig_txn_life',
      },
      { db: makeDb(captured), now }
    );

    expect(captured.insertValues?.expiresAt).toBeNull();
    expect(captured.onConflict?.set.expiresAt).toBeNull();
  });
});

describe('markGrantStatus', () => {
  it('sets the status without touching willRenew', async () => {
    const captured: Captured = {};

    await markGrantStatus(
      { source: 'revenuecat', externalRef: 'orig_txn_1', status: 'expired' },
      { db: makeDb(captured), now }
    );

    expect(captured.updateSet).toEqual({
      status: 'expired',
      updatedAt: fixedNow,
    });
  });
});

describe('setGrantWillRenew', () => {
  it('flips willRenew without touching status (cancellation keeps access)', async () => {
    const captured: Captured = {};

    await setGrantWillRenew(
      { source: 'revenuecat', externalRef: 'orig_txn_1', willRenew: false },
      { db: makeDb(captured), now }
    );

    expect(captured.updateSet).toEqual({
      willRenew: false,
      updatedAt: fixedNow,
    });
    expect(captured.updateSet).not.toHaveProperty('status');
  });
});

describe('reassignGrants', () => {
  it('no-ops on an empty ref list', async () => {
    const captured: Captured = {};
    await reassignGrants(
      { source: 'revenuecat', externalRefs: [], userId },
      { db: makeDb(captured), now }
    );
    expect(captured.updateSet).toBeUndefined();
  });

  it('updates userId for each ref', async () => {
    const captured: Captured = {};
    await reassignGrants(
      { source: 'revenuecat', externalRefs: ['a', 'b'], userId },
      { db: makeDb(captured), now }
    );
    expect(captured.updateSet).toEqual({ userId, updatedAt: fixedNow });
  });
});
