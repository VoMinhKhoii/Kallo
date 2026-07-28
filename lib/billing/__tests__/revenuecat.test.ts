import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let parseRevenueCatSnapshot: typeof import('../revenuecat').parseRevenueCatSnapshot;
let fetchRevenueCatSnapshot: typeof import('../revenuecat').fetchRevenueCatSnapshot;
let getBillingEnvironmentForUser: typeof import('../revenuecat').getBillingEnvironmentForUser;

beforeAll(async () => {
  ({
    parseRevenueCatSnapshot,
    fetchRevenueCatSnapshot,
    getBillingEnvironmentForUser,
  } = await import('../revenuecat'));
});

afterEach(() => {
  delete process.env.BILLING_SANDBOX_USER_IDS;
  delete process.env.BILLING_ENVIRONMENT;
});

const USER_ID = '11111111-1111-1111-1111-111111111111';
const REVIEW_USER_ID = '11111111-1111-4111-8111-111111111111';
const now = new Date('2026-07-13T00:00:00.000Z');

describe('getBillingEnvironmentForUser', () => {
  it('isolates sandbox projection to an explicitly allowlisted review UUID', () => {
    process.env.BILLING_ENVIRONMENT = 'production';
    process.env.BILLING_SANDBOX_USER_IDS = `${REVIEW_USER_ID},not-a-uuid`;

    expect(getBillingEnvironmentForUser(REVIEW_USER_ID)).toBe('sandbox');
    expect(
      getBillingEnvironmentForUser('22222222-2222-4222-8222-222222222222')
    ).toBe('production');
  });
});

function customerInfo(overrides: Record<string, unknown> = {}) {
  return {
    request_date: now.toISOString(),
    request_date_ms: now.getTime(),
    subscriber: {
      entitlements: {},
      management_url: null,
      non_subscriptions: {},
      original_app_user_id: USER_ID,
      subscriptions: {},
      ...overrides,
    },
  };
}

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

describe('fetchRevenueCatSnapshot', () => {
  it('URL-encodes the customer id and sends the server API key', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(customerInfo()), { status: 200 })
    );
    await fetchRevenueCatSnapshot('user/with spaces', {
      apiKey: 'appl_public-key',
      fetch: fetchMock as typeof fetch,
      billingEnvironment: 'production',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.revenuecat.com/v1/subscribers/user%2Fwith%20spaces',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer appl_public-key',
        }),
      })
    );
  });

  it('surfaces provider HTTP failures as retryable processing errors', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 503 }));
    await expect(
      fetchRevenueCatSnapshot(USER_ID, {
        apiKey: 'appl_public-key',
        fetch: fetchMock as typeof fetch,
        billingEnvironment: 'production',
      })
    ).rejects.toThrow('revenuecat_http_503');
  });

  it('marks a 201 response as a newly created empty customer', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(customerInfo()), { status: 201 })
    );
    const snapshot = await fetchRevenueCatSnapshot(USER_ID, {
      apiKey: 'appl_public-key',
      fetch: fetchMock as typeof fetch,
      billingEnvironment: 'production',
    });
    expect(snapshot.customerCreated).toBe(true);
  });

  it.each([
    'sk_project-secret',
    'atk_project-secret',
    'server-key',
  ])('rejects non-public RevenueCat credentials before fetching (%s)', async (apiKey) => {
    const fetchMock = vi.fn();
    await expect(
      fetchRevenueCatSnapshot(USER_ID, {
        apiKey,
        fetch: fetchMock as typeof fetch,
        billingEnvironment: 'production',
      })
    ).rejects.toThrow('revenuecat_rest_api_key_invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows Test Store keys only in sandbox deployments', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(customerInfo()), { status: 200 })
    );
    await expect(
      fetchRevenueCatSnapshot(USER_ID, {
        apiKey: 'test_public-key',
        fetch: fetchMock as typeof fetch,
        billingEnvironment: 'production',
      })
    ).rejects.toThrow('revenuecat_rest_api_key_invalid');
    expect(fetchMock).not.toHaveBeenCalled();

    await fetchRevenueCatSnapshot(USER_ID, {
      apiKey: 'test_public-key',
      fetch: fetchMock as typeof fetch,
      billingEnvironment: 'sandbox',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
