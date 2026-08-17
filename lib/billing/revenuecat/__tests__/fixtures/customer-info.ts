/** A minimal, valid RevenueCat v1 CustomerInfo body — the shared starting
 * point for the parse and fetch suites. `overrides` replaces keys on
 * `subscriber`, which is where every interesting case lives. */

export const CUSTOMER_INFO_USER_ID = '11111111-1111-1111-1111-111111111111';
export const CUSTOMER_INFO_NOW = new Date('2026-07-13T00:00:00.000Z');

export function customerInfo(overrides: Record<string, unknown> = {}) {
  return {
    request_date: CUSTOMER_INFO_NOW.toISOString(),
    request_date_ms: CUSTOMER_INFO_NOW.getTime(),
    subscriber: {
      entitlements: {},
      management_url: null,
      non_subscriptions: {},
      original_app_user_id: CUSTOMER_INFO_USER_ID,
      subscriptions: {},
      ...overrides,
    },
  };
}
