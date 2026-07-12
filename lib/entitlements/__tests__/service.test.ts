import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppDb } from '@/lib/db';
import type { entitlementGrants } from '@/lib/db/schema';
import { checkFeatureAccess, getEntitlementState } from '../service';

type GrantRow = typeof entitlementGrants.$inferSelect;

const userId = '11111111-1111-1111-1111-111111111111';
const fixedNow = new Date('2026-08-10T12:00:00.000Z');
const now = () => fixedNow;

// Signup well before any launch date used in these tests.
const oldSignup = new Date('2026-01-01T00:00:00.000Z');

function makeGrant(overrides: Partial<GrantRow>): GrantRow {
  return {
    id: crypto.randomUUID(),
    userId,
    entitlementKey: 'premium',
    source: 'revenuecat',
    productId: 'nham_premium_monthly',
    startsAt: new Date('2026-08-01T00:00:00.000Z'),
    expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    status: 'active',
    willRenew: true,
    externalRef: 'ext_ref',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

// Minimal stub matching the one query the service issues:
// db.select().from(entitlementGrants).where(...) resolving to grant rows.
function makeDb(rows: GrantRow[]): AppDb {
  return {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(rows),
      }),
    }),
  } as unknown as AppDb;
}

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.SUBSCRIPTION_LAUNCH_DATE = '2026-08-01T00:00:00.000Z';
  process.env.TRIAL_DAYS = '7';
  delete process.env.BILLING_ENFORCEMENT_ENABLED;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('getEntitlementState — trial', () => {
  it('no grants + trial active inside window → free tier, feature allowed via trial', async () => {
    // launch 2026-08-01, signup older → trial 08-01..08-08, now 08-10 is past…
    // use a signup after launch so trial is still open.
    const state = await getEntitlementState(
      { userId, profileCreatedAt: new Date('2026-08-06T00:00:00.000Z') },
      { db: makeDb([]), now }
    );

    expect(state.tier).toBe('free');
    expect(state.trial.active).toBe(true);
    expect(state.trial.endsAt?.toISOString()).toBe('2026-08-13T00:00:00.000Z');
    expect(state.trial.daysRemaining).toBe(3);
    expect(state.features.ai_analysis).toEqual({
      allowed: true,
      reason: 'trial',
    });
  });

  it('exactly at endsAt → trial expired, feature blocked with trial_expired', async () => {
    // trialStart = launch (2026-08-03), ends = 08-10T12:00 == now.
    process.env.SUBSCRIPTION_LAUNCH_DATE = '2026-08-03T12:00:00.000Z';
    const state = await getEntitlementState(
      { userId, profileCreatedAt: oldSignup },
      { db: makeDb([]), now }
    );

    expect(state.trial.endsAt?.toISOString()).toBe(fixedNow.toISOString());
    expect(state.trial.active).toBe(false);
    expect(state.trial.daysRemaining).toBe(0);
    expect(state.features.ai_analysis).toEqual({
      allowed: false,
      reason: 'trial_expired',
    });
  });

  it('launch date later than signup → fresh trial window for old users', async () => {
    process.env.SUBSCRIPTION_LAUNCH_DATE = '2026-08-08T00:00:00.000Z';
    const state = await getEntitlementState(
      { userId, profileCreatedAt: oldSignup },
      { db: makeDb([]), now }
    );

    // trialStart = launch 08-08, ends 08-15; now 08-10 → still active.
    expect(state.trial.active).toBe(true);
    expect(state.trial.endsAt?.toISOString()).toBe('2026-08-15T00:00:00.000Z');
    expect(state.trial.daysRemaining).toBe(5);
  });

  it('launch date unset → fail open, trial active', async () => {
    delete process.env.SUBSCRIPTION_LAUNCH_DATE;
    const state = await getEntitlementState(
      { userId, profileCreatedAt: oldSignup },
      { db: makeDb([]), now }
    );

    expect(state.trial.active).toBe(true);
    expect(state.trial.endsAt).toBeNull();
    expect(state.trial.daysRemaining).toBe(7);
    expect(state.features.ai_analysis.allowed).toBe(true);
  });
});

describe('getEntitlementState — grants', () => {
  it('active monthly grant → premium, entitled with expiresAt/willRenew', async () => {
    const grant = makeGrant({
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
      willRenew: true,
      source: 'revenuecat',
    });
    const state = await getEntitlementState(
      { userId, profileCreatedAt: oldSignup },
      { db: makeDb([grant]), now }
    );

    expect(state.tier).toBe('premium');
    expect(state.isLifetime).toBe(false);
    expect(state.expiresAt?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(state.willRenew).toBe(true);
    expect(state.source).toBe('revenuecat');
    expect(state.features.ai_analysis).toEqual({
      allowed: true,
      reason: 'entitled',
    });
  });

  it('expired-by-clock grant with stale active status → not entitled (trial_expired)', async () => {
    // status still 'active' but expiresAt already past now.
    process.env.SUBSCRIPTION_LAUNCH_DATE = '2026-08-01T00:00:00.000Z';
    const grant = makeGrant({
      status: 'active',
      expiresAt: new Date('2026-08-05T00:00:00.000Z'),
    });
    const state = await getEntitlementState(
      { userId, profileCreatedAt: oldSignup },
      { db: makeDb([grant]), now }
    );

    // trial (start 08-01) ended 08-08, now 08-10 → expired.
    expect(state.tier).toBe('free');
    expect(state.expiresAt).toBeNull();
    expect(state.features.ai_analysis).toEqual({
      allowed: false,
      reason: 'trial_expired',
    });
  });

  it('lifetime beats monthly (winning grant selection)', async () => {
    const monthly = makeGrant({
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
      willRenew: true,
      source: 'revenuecat',
    });
    const lifetime = makeGrant({
      expiresAt: null,
      willRenew: false,
      source: 'promo',
      productId: 'nham_premium_lifetime',
    });
    const state = await getEntitlementState(
      { userId, profileCreatedAt: oldSignup },
      { db: makeDb([monthly, lifetime]), now }
    );

    expect(state.tier).toBe('premium');
    expect(state.isLifetime).toBe(true);
    expect(state.expiresAt).toBeNull();
    expect(state.willRenew).toBe(false);
    expect(state.source).toBe('promo');
  });

  it('canceled-in-period (status active, willRenew false) → still entitled', async () => {
    const grant = makeGrant({
      status: 'active',
      willRenew: false,
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    const state = await getEntitlementState(
      { userId, profileCreatedAt: oldSignup },
      { db: makeDb([grant]), now }
    );

    expect(state.tier).toBe('premium');
    expect(state.willRenew).toBe(false);
    expect(state.features.ai_analysis.reason).toBe('entitled');
  });

  it('refunded / expired status rows are ignored', async () => {
    process.env.SUBSCRIPTION_LAUNCH_DATE = '2026-08-01T00:00:00.000Z';
    const refunded = makeGrant({
      status: 'refunded',
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    const expired = makeGrant({
      status: 'expired',
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    const state = await getEntitlementState(
      { userId, profileCreatedAt: oldSignup },
      { db: makeDb([refunded, expired]), now }
    );

    expect(state.tier).toBe('free');
    expect(state.expiresAt).toBeNull();
  });
});

describe('checkFeatureAccess', () => {
  it('returns allowed true when entitled', async () => {
    const grant = makeGrant({});
    const result = await checkFeatureAccess(
      { userId, profileCreatedAt: oldSignup },
      'ai_analysis',
      { db: makeDb([grant]), now }
    );
    expect(result).toEqual({ allowed: true });
  });

  it('returns allowed false with reason when trial expired and no grant', async () => {
    process.env.SUBSCRIPTION_LAUNCH_DATE = '2026-08-01T00:00:00.000Z';
    const result = await checkFeatureAccess(
      { userId, profileCreatedAt: oldSignup },
      'ai_analysis',
      { db: makeDb([]), now }
    );
    expect(result).toEqual({ allowed: false, reason: 'trial_expired' });
  });
});
