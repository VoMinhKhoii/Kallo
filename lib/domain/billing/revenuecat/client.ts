import 'server-only';

import {
  type BillingEnvironment,
  getBillingEnvironment,
} from '@/lib/domain/billing/revenuecat/identity';
import {
  parseRevenueCatSnapshot,
  type RevenueCatSnapshot,
} from '@/lib/domain/billing/revenuecat/snapshot';

// The RevenueCat REST edge: read one customer's CustomerInfo. This is the only
// place that talks to `api.revenuecat.com/v1`; every caller consumes the parsed
// `RevenueCatSnapshot` instead of the wire payload.

export interface RevenueCatClientDeps {
  apiKey?: string;
  fetch?: typeof fetch;
  billingEnvironment?: BillingEnvironment;
}

export async function fetchRevenueCatSnapshot(
  appUserId: string,
  deps: RevenueCatClientDeps = {}
): Promise<RevenueCatSnapshot> {
  const billingEnvironment = getBillingEnvironment(deps.billingEnvironment);
  const apiKey = deps.apiKey ?? process.env.REVENUECAT_REST_API_KEY;
  if (!apiKey) throw new Error('revenuecat_rest_api_key_missing');
  const allowedPrefixes =
    billingEnvironment === 'sandbox'
      ? ['appl_', 'goog_', 'rcb_', 'test_']
      : ['appl_', 'goog_', 'rcb_'];
  if (!allowedPrefixes.some((prefix) => apiKey.startsWith(prefix))) {
    // The v1 CustomerInfo endpoint only needs an app-public SDK key. Reject
    // project-wide sk_/atk_ credentials so an accidental secret deployment
    // cannot silently widen this runtime's RevenueCat authority.
    throw new Error('revenuecat_rest_api_key_invalid');
  }

  const fetchImpl = deps.fetch ?? fetch;
  const response = await fetchImpl(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    }
  );
  if (!response.ok) {
    throw new Error(`revenuecat_http_${response.status}`);
  }

  const snapshot = parseRevenueCatSnapshot(
    await response.json(),
    appUserId,
    billingEnvironment
  );
  return { ...snapshot, customerCreated: response.status === 201 };
}
