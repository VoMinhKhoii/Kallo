import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppDb } from '@/lib/infra/db/client';
import type { entitlementGrants } from '@/lib/infra/db/schema';
import { checkFeatureAccess, getEntitlementState } from '../service';

type GrantRow = typeof entitlementGrants.$inferSelect;

const userId = '11111111-1111-1111-1111-111111111111';
const fixedNow = new Date('2026-08-10T12:00:00.000Z');
const now = () => fixedNow;

function makeGrant(overrides: Partial<GrantRow>): GrantRow {
  return {
    id: crypto.randomUUID(),
    userId,
    entitlementKey: 'premium',
    source: 'revenuecat',
    environment: 'production',
    store: null,
    productId: 'kallo_premium_monthly',
    startsAt: new Date('2026-08-01T00:00:00.000Z'),
    expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    status: 'active',
    willRenew: true,
    externalRef: 'ext_ref',
    providerSyncedAt: fixedNow,
    managementUrl: null,
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
        where: (expression: unknown) => {
          const params = extractParams(expression);
          return Promise.resolve(
            rows.filter(
              (row) =>
                params.includes(row.userId) && params.includes(row.environment)
            )
          );
        },
      }),
    }),
  } as unknown as AppDb;
}

function extractParams(expression: unknown): unknown[] {
  const output: unknown[] = [];
  const seen = new Set<unknown>();
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    const object = node as Record<string, unknown>;
    if (object.constructor?.name === 'Param' && 'value' in object) {
      output.push(object.value);
    }
    if (Array.isArray(object.queryChunks)) object.queryChunks.forEach(walk);
    if (Array.isArray(node)) node.forEach(walk);
  };
  walk(expression);
  return output;
}

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.BILLING_ENVIRONMENT = 'production';
  delete process.env.BILLING_ENFORCEMENT_ENABLED;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('getEntitlementState — welcome premium', () => {
  // The 14-day welcome grant written at signup (migration
  // 20261002131554_welcome_premium_grants.sql) is an ordinary promo grant:
  // there is no derived trial, so it must read as real Premium.
  const welcome = (expiresAt: Date) =>
    makeGrant({
      source: 'promo',
      productId: 'welcome_premium_14d',
      externalRef: `welcome:${userId}`,
      startsAt: new Date('2026-08-01T00:00:00.000Z'),
      expiresAt,
      willRenew: false,
      providerSyncedAt: null,
    });

  it('no grants → free, every feature not_entitled', async () => {
    const state = await getEntitlementState(
      { userId },
      { db: makeDb([]), now }
    );

    expect(state.tier).toBe('free');
    expect(state.features.ai_analysis).toEqual({
      allowed: false,
      reason: 'not_entitled',
    });
  });

  it('an active welcome grant → premium tier with its end date', async () => {
    const state = await getEntitlementState(
      { userId },
      { db: makeDb([welcome(new Date('2026-08-15T00:00:00.000Z'))]), now }
    );

    expect(state.tier).toBe('premium');
    expect(state.source).toBe('promo');
    expect(state.expiresAt?.toISOString()).toBe('2026-08-15T00:00:00.000Z');
    expect(state.willRenew).toBe(false);
    expect(state.hasActiveSubscription).toBe(false);
    // A promo grant never asks RevenueCat for a refresh.
    expect(state.reconciliationRequired).toBe(false);
    expect(state.features.ai_analysis).toEqual({
      allowed: true,
      reason: 'entitled',
    });
  });

  it('exactly at the welcome grant expiry → free', async () => {
    const state = await getEntitlementState(
      { userId },
      { db: makeDb([welcome(fixedNow)]), now }
    );

    expect(state.tier).toBe('free');
    expect(state.features.ai_analysis.allowed).toBe(false);
  });

  it('a purchase running past the welcome grant wins', async () => {
    const state = await getEntitlementState(
      { userId },
      {
        db: makeDb([
          welcome(new Date('2026-08-15T00:00:00.000Z')),
          makeGrant({ expiresAt: new Date('2026-09-10T00:00:00.000Z') }),
        ]),
        now,
      }
    );

    expect(state.tier).toBe('premium');
    expect(state.source).toBe('revenuecat');
    expect(state.expiresAt?.toISOString()).toBe('2026-09-10T00:00:00.000Z');
  });

  // A store intro week can end before the welcome grant does. Access is the
  // promo's, but a renewing subscription must not read as "ends <promo date>"
  // while the store keeps charging.
  const introWeek = (willRenew: boolean) => [
    welcome(new Date('2026-08-15T00:00:00.000Z')),
    makeGrant({
      expiresAt: new Date('2026-08-12T00:00:00.000Z'),
      willRenew,
      externalRef: 'rc-premium',
    }),
    makeGrant({
      entitlementKey: 'billing_subscription',
      expiresAt: new Date('2026-08-12T00:00:00.000Z'),
      willRenew,
      store: 'app_store',
      externalRef: 'rc-subscription',
    }),
  ];

  it('a renewing subscription owns the lifecycle fields over a longer promo', async () => {
    const state = await getEntitlementState(
      { userId },
      { db: makeDb(introWeek(true)), now }
    );

    expect(state.tier).toBe('premium');
    expect(state.hasActiveSubscription).toBe(true);
    expect(state.willRenew).toBe(true);
    expect(state.expiresAt?.toISOString()).toBe('2026-08-12T00:00:00.000Z');
  });

  it('a stale subscription behind a winning promo still asks for reconciliation', async () => {
    const stale = introWeek(true).map((grant) =>
      grant.source === 'revenuecat'
        ? { ...grant, providerSyncedAt: new Date('2026-08-08T00:00:00.000Z') }
        : grant
    );
    const fresh = await getEntitlementState(
      { userId },
      { db: makeDb(introWeek(true)), now }
    );
    const state = await getEntitlementState(
      { userId },
      { db: makeDb(stale), now }
    );

    expect(fresh.reconciliationRequired).toBe(false);
    expect(state.source).toBe('promo');
    expect(state.reconciliationRequired).toBe(true);
  });

  it('a renewing subscription wins the lifecycle over a further-out cancelled one', async () => {
    const state = await getEntitlementState(
      { userId },
      {
        db: makeDb([
          ...introWeek(true),
          makeGrant({
            entitlementKey: 'billing_subscription',
            expiresAt: new Date('2026-08-14T00:00:00.000Z'),
            willRenew: false,
            store: 'play_store',
            externalRef: 'rc-subscription-cancelled',
          }),
        ]),
        now,
      }
    );

    expect(state.willRenew).toBe(true);
    expect(state.expiresAt?.toISOString()).toBe('2026-08-12T00:00:00.000Z');
  });

  it('a cancelled subscription reports the furthest access date', async () => {
    const state = await getEntitlementState(
      { userId },
      { db: makeDb(introWeek(false)), now }
    );

    expect(state.willRenew).toBe(false);
    expect(state.expiresAt?.toISOString()).toBe('2026-08-15T00:00:00.000Z');
  });
});

describe('getEntitlementState — grants', () => {
  it.each([
    {
      billingEnvironment: 'production' as const,
      expectedStore: 'app_store',
    },
    {
      billingEnvironment: 'sandbox' as const,
      expectedStore: 'play_store',
    },
  ])('reads only $billingEnvironment grants when environments share a database', async ({
    billingEnvironment,
    expectedStore,
  }) => {
    const production = makeGrant({
      environment: 'production',
      externalRef: 'same-provider-reference',
      store: 'app_store',
    });
    const sandbox = makeGrant({
      environment: 'sandbox',
      externalRef: 'same-provider-reference',
      store: 'play_store',
    });

    const state = await getEntitlementState(
      { userId },
      {
        db: makeDb([production, sandbox]),
        now,
        billingEnvironment,
      }
    );

    expect(state.tier).toBe('premium');
    expect(state.store).toBe(expectedStore);
  });

  it('active monthly grant → premium, entitled with expiresAt/willRenew', async () => {
    const grant = makeGrant({
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
      willRenew: true,
      source: 'revenuecat',
      store: 'app_store',
    });
    const state = await getEntitlementState(
      { userId },
      { db: makeDb([grant]), now }
    );

    expect(state.tier).toBe('premium');
    expect(state.isLifetime).toBe(false);
    expect(state.expiresAt?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(state.willRenew).toBe(true);
    expect(state.reconciliationRequired).toBe(false);
    expect(state.source).toBe('revenuecat');
    // The winning grant's store passes through for the settings deep link.
    expect(state.store).toBe('app_store');
    expect(state.features.ai_analysis).toEqual({
      allowed: true,
      reason: 'entitled',
    });
  });

  it('stale active RevenueCat grant requests a provider refresh', async () => {
    const grant = makeGrant({
      providerSyncedAt: new Date('2026-08-09T11:59:59.999Z'),
    });
    const state = await getEntitlementState(
      { userId },
      { db: makeDb([grant]), now }
    );

    expect(state.tier).toBe('premium');
    expect(state.reconciliationRequired).toBe(true);
  });

  it('fresh active RevenueCat grant does not request a provider refresh', async () => {
    const grant = makeGrant({
      providerSyncedAt: new Date('2026-08-09T12:00:00.001Z'),
    });
    const state = await getEntitlementState(
      { userId },
      { db: makeDb([grant]), now }
    );

    expect(state.reconciliationRequired).toBe(false);
  });

  it('expired-by-clock grant with stale active status → not entitled', async () => {
    // status still 'active' but expiresAt already past now.
    const grant = makeGrant({
      status: 'active',
      expiresAt: new Date('2026-08-05T00:00:00.000Z'),
    });
    const state = await getEntitlementState(
      { userId },
      { db: makeDb([grant]), now }
    );

    expect(state.tier).toBe('free');
    expect(state.reconciliationRequired).toBe(true);
    expect(state.expiresAt).toBeNull();
    expect(state.features.ai_analysis).toEqual({
      allowed: false,
      reason: 'not_entitled',
    });
  });

  it.each([
    {
      name: 'canceled subscription',
      overrides: {
        status: 'active',
        willRenew: false,
        expiresAt: new Date('2026-08-05T00:00:00.000Z'),
      },
    },
    {
      name: 'provider-confirmed expiration',
      overrides: {
        status: 'expired',
        willRenew: true,
        expiresAt: new Date('2026-08-05T00:00:00.000Z'),
      },
    },
    {
      name: 'non-RevenueCat grant',
      overrides: {
        source: 'promo',
        status: 'active',
        willRenew: true,
        expiresAt: new Date('2026-08-05T00:00:00.000Z'),
      },
    },
  ])('does not request reconciliation for $name', async ({ overrides }) => {
    const state = await getEntitlementState(
      { userId },
      { db: makeDb([makeGrant(overrides)]), now }
    );

    expect(state.reconciliationRequired).toBe(false);
  });

  it('reconciles an expired RevenueCat grant alongside an active promo', async () => {
    const promo = makeGrant({
      source: 'promo',
      externalRef: 'promo-ref',
    });
    const expiredRevenueCat = makeGrant({
      expiresAt: new Date('2026-08-05T00:00:00.000Z'),
      externalRef: 'revenuecat-ref',
    });

    const state = await getEntitlementState(
      { userId },
      { db: makeDb([promo, expiredRevenueCat]), now }
    );

    expect(state.tier).toBe('premium');
    expect(state.source).toBe('promo');
    expect(state.reconciliationRequired).toBe(true);
  });

  it.each([
    { expiresAt: new Date('2026-09-01T00:00:00.000Z') },
    { expiresAt: null },
  ])('does not activate a future grant with expiresAt=$expiresAt', async ({
    expiresAt,
  }) => {
    const grant = makeGrant({
      startsAt: new Date('2026-08-11T00:00:00.000Z'),
      expiresAt,
    });
    const state = await getEntitlementState(
      { userId },
      { db: makeDb([grant]), now }
    );

    expect(state.tier).toBe('free');
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
      productId: 'kallo_premium_lifetime',
    });
    const state = await getEntitlementState(
      { userId },
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
      { userId },
      { db: makeDb([grant]), now }
    );

    expect(state.tier).toBe('premium');
    expect(state.willRenew).toBe(false);
    expect(state.features.ai_analysis.reason).toBe('entitled');
  });

  it('refunded / expired status rows are ignored', async () => {
    const refunded = makeGrant({
      status: 'refunded',
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    const expired = makeGrant({
      status: 'expired',
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    const state = await getEntitlementState(
      { userId },
      { db: makeDb([refunded, expired]), now }
    );

    expect(state.tier).toBe('free');
    expect(state.expiresAt).toBeNull();
  });
});

describe('checkFeatureAccess', () => {
  it('returns allowed true when entitled', async () => {
    const grant = makeGrant({});
    const result = await checkFeatureAccess({ userId }, 'ai_analysis', {
      db: makeDb([grant]),
      now,
    });
    expect(result).toEqual({ allowed: true });
  });

  it('returns allowed false with not_entitled when there is no grant', async () => {
    const result = await checkFeatureAccess({ userId }, 'ai_analysis', {
      db: makeDb([]),
      now,
    });
    expect(result).toEqual({ allowed: false, reason: 'not_entitled' });
  });
});

// The catalog is the only place a gated feature is declared, and the state
// builder walks it — so every Premium-card feature must appear here without
// any per-feature code in the service.
const PREMIUM_FEATURES = [
  'ai_analysis',
  'label_scan',
  'micronutrients',
  'relog',
  'cheat_meal',
  'copy_split',
  'unlimited_circle',
] as const;

describe('feature catalog coverage', () => {
  it('exposes every gated feature in the state', async () => {
    const state = await getEntitlementState(
      { userId },
      { db: makeDb([]), now }
    );
    expect(Object.keys(state.features).sort()).toEqual(
      [...PREMIUM_FEATURES].sort()
    );
  });

  it('no grant locks every one as not_entitled', async () => {
    const state = await getEntitlementState(
      { userId },
      { db: makeDb([]), now }
    );

    for (const key of PREMIUM_FEATURES) {
      expect(state.features[key]).toEqual({
        allowed: false,
        reason: 'not_entitled',
      });
    }
  });

  it('an active premium grant entitles every one', async () => {
    const state = await getEntitlementState(
      { userId },
      { db: makeDb([makeGrant({})]), now }
    );

    expect(state.tier).toBe('premium');
    for (const key of PREMIUM_FEATURES) {
      expect(state.features[key]).toEqual({
        allowed: true,
        reason: 'entitled',
      });
    }
  });
});
