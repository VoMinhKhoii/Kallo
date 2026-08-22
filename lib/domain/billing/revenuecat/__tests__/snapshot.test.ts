import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  CUSTOMER_INFO_NOW,
  CUSTOMER_INFO_USER_ID,
  customerInfo,
} from './fixtures/customer-info';

vi.mock('server-only', () => ({}));

let parseRevenueCatSnapshot: typeof import('../snapshot').parseRevenueCatSnapshot;

beforeAll(async () => {
  ({ parseRevenueCatSnapshot } = await import('../snapshot'));
});

const USER_ID = CUSTOMER_INFO_USER_ID;
const now = CUSTOMER_INFO_NOW;

describe('parseRevenueCatSnapshot', () => {
  it('projects active access and a separate renewable-management row', () => {
    const snapshot = parseRevenueCatSnapshot(
      customerInfo({
        entitlements: {
          premium: {
            expires_date: '2026-08-01T00:00:00Z',
            grace_period_expires_date: null,
            product_identifier: 'kallo_premium_monthly',
            purchase_date: '2026-07-01T00:00:00Z',
          },
        },
        management_url: 'https://apps.apple.com/account/subscriptions',
        subscriptions: {
          kallo_premium_monthly: {
            expires_date: '2026-08-01T00:00:00Z',
            grace_period_expires_date: null,
            purchase_date: '2026-07-01T00:00:00Z',
            original_purchase_date: '2026-06-01T00:00:00Z',
            store: 'APP_STORE',
            is_sandbox: false,
            unsubscribe_detected_at: null,
            refunded_at: null,
          },
        },
      }),
      USER_ID,
      'production',
      now
    );

    expect(snapshot.providerSyncedAt).toEqual(now);
    expect(snapshot.grants).toHaveLength(2);
    expect(snapshot.grants[0]).toMatchObject({
      entitlementKey: 'premium',
      store: 'app_store',
      willRenew: true,
    });
    expect(snapshot.grants[1]).toMatchObject({
      entitlementKey: 'billing_subscription',
      managementUrl: 'https://apps.apple.com/account/subscriptions',
    });
  });

  it('uses RevenueCat customer identity so aliases cannot mint duplicate refs', () => {
    const raw = customerInfo({
      entitlements: {
        premium: {
          expires_date: '2026-08-01T00:00:00Z',
          grace_period_expires_date: null,
          product_identifier: 'kallo_premium_monthly',
          purchase_date: '2026-07-01T00:00:00Z',
        },
      },
      subscriptions: {
        kallo_premium_monthly: {
          expires_date: '2026-08-01T00:00:00Z',
          grace_period_expires_date: null,
          purchase_date: '2026-07-01T00:00:00Z',
          store: 'APP_STORE',
          is_sandbox: false,
          unsubscribe_detected_at: null,
          refunded_at: null,
        },
      },
    });

    const first = parseRevenueCatSnapshot(raw, USER_ID, 'production', now);
    const alias = parseRevenueCatSnapshot(
      raw,
      '22222222-2222-2222-2222-222222222222',
      'production',
      now
    );
    expect(alias.grants.map((grant) => grant.externalRef)).toEqual(
      first.grants.map((grant) => grant.externalRef)
    );
  });

  it('keeps a recurring subscription manageable when lifetime access wins', () => {
    const snapshot = parseRevenueCatSnapshot(
      customerInfo({
        entitlements: {
          premium: {
            expires_date: null,
            grace_period_expires_date: null,
            product_identifier: 'kallo_premium_lifetime',
            purchase_date: '2026-07-01T00:00:00Z',
          },
        },
        management_url: 'https://play.google.com/store/account/subscriptions',
        non_subscriptions: {
          kallo_premium_lifetime: [
            {
              id: 'lifetime-transaction',
              is_sandbox: false,
              purchase_date: '2026-07-01T00:00:00Z',
              store: 'PLAY_STORE',
            },
          ],
        },
        subscriptions: {
          'kallo_premium_annual:annual': {
            expires_date: '2027-01-01T00:00:00Z',
            grace_period_expires_date: null,
            purchase_date: '2026-01-01T00:00:00Z',
            store: 'PLAY_STORE',
            is_sandbox: false,
            unsubscribe_detected_at: null,
            refunded_at: null,
          },
        },
      }),
      USER_ID,
      'production',
      now
    );

    expect(snapshot.grants.map((grant) => grant.entitlementKey)).toEqual([
      'premium',
      'billing_subscription',
    ]);
    expect(snapshot.grants[0]?.expiresAt).toBeNull();
  });

  it('fails closed when the backing subscription was refunded', () => {
    const snapshot = parseRevenueCatSnapshot(
      customerInfo({
        entitlements: {
          premium: {
            expires_date: '2026-07-12T00:00:00Z',
            grace_period_expires_date: '2026-07-15T00:00:00Z',
            product_identifier: 'kallo_premium_monthly',
            purchase_date: '2026-06-12T00:00:00Z',
          },
        },
        subscriptions: {
          kallo_premium_monthly: {
            expires_date: '2026-07-12T00:00:00Z',
            grace_period_expires_date: '2026-07-15T00:00:00Z',
            purchase_date: '2026-06-12T00:00:00Z',
            store: 'APP_STORE',
            is_sandbox: false,
            unsubscribe_detected_at: null,
            refunded_at: '2026-07-12T00:00:00Z',
          },
        },
      }),
      USER_ID,
      'production',
      now
    );
    expect(snapshot.grants).toHaveLength(0);
  });

  it.each([
    {
      productId: 'kallo_premium_lifetime',
      expiresDate: '2026-08-01T00:00:00Z',
    },
    { productId: 'kallo_premium_monthly', expiresDate: null },
  ])('fails closed when $productId lifetime semantics contradict the provider', ({
    productId,
    expiresDate,
  }) => {
    const snapshot = parseRevenueCatSnapshot(
      customerInfo({
        entitlements: {
          premium: {
            expires_date: expiresDate,
            grace_period_expires_date: null,
            product_identifier: productId,
            purchase_date: '2026-07-01T00:00:00Z',
          },
        },
        subscriptions: {
          [productId]: {
            expires_date: expiresDate,
            grace_period_expires_date: null,
            purchase_date: '2026-07-01T00:00:00Z',
            store: 'APP_STORE',
            is_sandbox: false,
            unsubscribe_detected_at: null,
            refunded_at: null,
          },
        },
      }),
      USER_ID,
      'production',
      now
    );

    expect(
      snapshot.grants.filter((grant) => grant.entitlementKey === 'premium')
    ).toHaveLength(0);
  });

  it('isolates sandbox and production transactions', () => {
    const raw = customerInfo({
      entitlements: {
        premium: {
          expires_date: '2026-08-01T00:00:00Z',
          grace_period_expires_date: null,
          product_identifier: 'kallo_premium_monthly',
          purchase_date: '2026-07-01T00:00:00Z',
        },
      },
      subscriptions: {
        kallo_premium_monthly: {
          expires_date: '2026-08-01T00:00:00Z',
          grace_period_expires_date: null,
          purchase_date: '2026-07-01T00:00:00Z',
          store: 'APP_STORE',
          is_sandbox: true,
          unsubscribe_detected_at: null,
          refunded_at: null,
          store_transaction_id: 1000000652379790,
        },
      },
    });

    expect(
      parseRevenueCatSnapshot(raw, USER_ID, 'production', now).grants
    ).toHaveLength(0);
    expect(
      parseRevenueCatSnapshot(raw, USER_ID, 'sandbox', now).grants
    ).toHaveLength(2);
  });

  it('does not replace an exact wrong-environment subscription with a base plan', () => {
    const raw = customerInfo({
      entitlements: {
        premium: {
          expires_date: '2026-08-01T00:00:00Z',
          grace_period_expires_date: null,
          product_identifier: 'kallo_premium_monthly',
          purchase_date: '2026-07-01T00:00:00Z',
        },
      },
      subscriptions: {
        kallo_premium_monthly: {
          expires_date: '2026-08-01T00:00:00Z',
          grace_period_expires_date: null,
          purchase_date: '2026-07-01T00:00:00Z',
          store: 'PLAY_STORE',
          is_sandbox: true,
          unsubscribe_detected_at: null,
          refunded_at: null,
        },
        'kallo_premium_monthly:monthly': {
          expires_date: '2026-08-01T00:00:00Z',
          grace_period_expires_date: null,
          purchase_date: '2026-07-01T00:00:00Z',
          store: 'PLAY_STORE',
          is_sandbox: false,
          unsubscribe_detected_at: null,
          refunded_at: null,
        },
      },
    });

    expect(
      parseRevenueCatSnapshot(raw, USER_ID, 'production', now).grants
    ).toHaveLength(1);
    expect(
      parseRevenueCatSnapshot(raw, USER_ID, 'production', now).grants[0]
        ?.entitlementKey
    ).toBe('billing_subscription');
  });

  it('ignores unknown Google base plans beside the exact configured plan', () => {
    const baseSubscription = {
      expires_date: '2026-08-01T00:00:00Z',
      grace_period_expires_date: null,
      purchase_date: '2026-07-01T00:00:00Z',
      store: 'PLAY_STORE',
      is_sandbox: false,
      unsubscribe_detected_at: null,
      refunded_at: null,
    };
    const raw = customerInfo({
      entitlements: {
        premium: {
          expires_date: '2026-08-01T00:00:00Z',
          grace_period_expires_date: null,
          product_identifier: 'kallo_premium_monthly',
          purchase_date: '2026-07-01T00:00:00Z',
        },
      },
      subscriptions: {
        'kallo_premium_monthly:monthly': baseSubscription,
        'kallo_premium_monthly:legacy': baseSubscription,
      },
    });

    expect(
      parseRevenueCatSnapshot(raw, USER_ID, 'production', now).grants.filter(
        (grant) => grant.entitlementKey === 'premium'
      )
    ).toHaveLength(1);
  });

  it('rejects a cross-cadence Google base plan as backing evidence', () => {
    const raw = customerInfo({
      entitlements: {
        premium: {
          expires_date: '2026-08-01T00:00:00Z',
          grace_period_expires_date: null,
          product_identifier: 'kallo_premium_monthly',
          purchase_date: '2026-07-01T00:00:00Z',
        },
      },
      subscriptions: {
        'kallo_premium_monthly:annual': {
          expires_date: '2026-08-01T00:00:00Z',
          grace_period_expires_date: null,
          purchase_date: '2026-07-01T00:00:00Z',
          store: 'PLAY_STORE',
          is_sandbox: false,
          unsubscribe_detected_at: null,
          refunded_at: null,
        },
      },
    });

    expect(
      parseRevenueCatSnapshot(raw, USER_ID, 'production', now).grants
    ).toHaveLength(0);
  });

  it('rejects non-HTTPS management URLs from provider data', () => {
    expect(() =>
      parseRevenueCatSnapshot(
        customerInfo({ management_url: 'http://billing.example.test/manage' }),
        USER_ID,
        'production',
        now
      )
    ).toThrow();
  });

  it('correlates lifetime access to the exact environment purchase', () => {
    const raw = customerInfo({
      entitlements: {
        premium: {
          expires_date: null,
          grace_period_expires_date: null,
          product_identifier: 'kallo_premium_lifetime',
          purchase_date: '2026-07-12T00:00:00Z',
        },
      },
      non_subscriptions: {
        kallo_premium_lifetime: [
          {
            id: 'old-production-purchase',
            is_sandbox: false,
            purchase_date: '2026-06-01T00:00:00Z',
            store: 'APP_STORE',
          },
          {
            id: 'current-sandbox-purchase',
            is_sandbox: true,
            purchase_date: '2026-07-12T00:00:00Z',
            store: 'APP_STORE',
          },
        ],
      },
    });

    expect(
      parseRevenueCatSnapshot(raw, USER_ID, 'production', now).grants
    ).toHaveLength(0);
    expect(
      parseRevenueCatSnapshot(raw, USER_ID, 'sandbox', now).grants
    ).toHaveLength(1);
  });

  it('fails closed on provider schema drift', () => {
    expect(() =>
      parseRevenueCatSnapshot(
        { request_date_ms: 'not-a-number' },
        USER_ID,
        'production',
        now
      )
    ).toThrow();
  });

  it('does not grant access for a dashboard product outside the allowlist', () => {
    const snapshot = parseRevenueCatSnapshot(
      customerInfo({
        entitlements: {
          premium: {
            expires_date: '2026-08-01T00:00:00Z',
            grace_period_expires_date: null,
            product_identifier: 'unexpected_premium_product',
            purchase_date: '2026-07-01T00:00:00Z',
          },
        },
        subscriptions: {
          unexpected_premium_product: {
            expires_date: '2026-08-01T00:00:00Z',
            grace_period_expires_date: null,
            purchase_date: '2026-07-01T00:00:00Z',
            store: 'APP_STORE',
            is_sandbox: false,
            unsubscribe_detected_at: null,
            refunded_at: null,
          },
        },
      }),
      USER_ID,
      'production',
      now
    );
    expect(snapshot.grants).toHaveLength(0);
  });
});
