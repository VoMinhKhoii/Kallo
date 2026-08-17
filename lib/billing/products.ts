import type { EntitlementKey } from '@/lib/billing/entitlement/features';

// Maps RevenueCat store product identifiers to the entitlement they grant.
// RC reports the underlying store product id (App Store / Play / Paddle) on
// each purchase; the webhook resolves it here to decide which grant to write.
// Lifetime products produce a grant with expiresAt = NULL.
//
// Matching is exact by design — an id that is not in this catalog resolves to
// null and grants nothing. Paddle-imported products carry whatever identifier
// RevenueCat assigned at import; if that is the Paddle price id (`pri_…`)
// rather than a canonical id, it must be added here or a paying customer gets
// no grant. See the Paddle checklist in docs/BILLING.md.
export const PRODUCT_ENTITLEMENTS: Record<
  string,
  { entitlementKey: EntitlementKey; lifetime: boolean }
> = {
  kallo_premium_monthly: { entitlementKey: 'premium', lifetime: false },
  kallo_premium_annual: { entitlementKey: 'premium', lifetime: false },
  kallo_premium_lifetime: { entitlementKey: 'premium', lifetime: true },
};

const CANONICAL_PRODUCT_IDS = new Set([
  'kallo_premium_monthly',
  'kallo_premium_annual',
  'kallo_premium_lifetime',
]);

const GOOGLE_BASE_PLAN_PRODUCTS: Record<string, string> = {
  'kallo_premium_monthly:monthly': 'kallo_premium_monthly',
  'kallo_premium_annual:annual': 'kallo_premium_annual',
};

// RevenueCat imports Paddle prices under their opaque Paddle price id, so the
// web catalog cannot be keyed on our canonical names the way Apple and Google
// are. Every id RevenueCat can report for a web purchase must appear here: an
// id missing from this map resolves to null, the paywall hides the package,
// and — worse — a completed Paddle purchase projects no grant.
//
// Sandbox and production are separate Paddle accounts and therefore have
// SEPARATE price ids. Both belong in this map; adding the production account
// later is a code change, not just a dashboard change.
const PADDLE_PRICE_PRODUCTS: Record<string, string> = {
  // Sandbox (Kallo Paddle sandbox account)
  pri_01kyy23rh7qjch1798kfwqx8x8: 'kallo_premium_monthly',
  pri_01kyy258p8ay94vzvyznz6k9r0: 'kallo_premium_annual',
  pri_01kyy26yps3tt1zf1vjhhcvkp8: 'kallo_premium_lifetime',
  // Production (Kallo Paddle live account, product pro_01kz49s9ga4n2h57k40zv88bgn)
  pri_01kz49s9hjsmk53evgrsh55ccr: 'kallo_premium_monthly',
  pri_01kz49s9jm5m5xhzwktnz4005q: 'kallo_premium_annual',
  pri_01kz49s9kxp82v1r03caxc1gqh: 'kallo_premium_lifetime',
};

/** Resolve only exact catalog identifiers to their canonical product id. */
export function canonicalProductId(productId: string): string | null {
  if (CANONICAL_PRODUCT_IDS.has(productId)) return productId;
  return (
    GOOGLE_BASE_PLAN_PRODUCTS[productId] ??
    PADDLE_PRICE_PRODUCTS[productId] ??
    null
  );
}

// Lifetime is deferred on web: the production Paddle price is archived, so it
// cannot be bought. RevenueCat still serves an `$rc_lifetime` package in the
// `default` offering (the dashboard offering is shared with iOS and Android,
// which DO still sell lifetime), so the paywall would otherwise render a card
// that leads to a dead checkout. Deliberately NOT removed from
// PADDLE_PRICE_PRODUCTS: if a lifetime purchase somehow lands, the id must
// still resolve so the grant projects rather than being silently dropped.
const WEB_DEFERRED_PRODUCTS = new Set(['kallo_premium_lifetime']);

export function isAllowedWebProduct(productId: string): boolean {
  const canonical = canonicalProductId(productId);
  if (canonical === null || WEB_DEFERRED_PRODUCTS.has(canonical)) return false;
  return (
    CANONICAL_PRODUCT_IDS.has(productId) || productId in PADDLE_PRICE_PRODUCTS
  );
}

export function isAllowedMobileProduct(productId: string): boolean {
  return (
    CANONICAL_PRODUCT_IDS.has(productId) ||
    productId in GOOGLE_BASE_PLAN_PRODUCTS
  );
}

export function resolveProduct(
  productId: string
): { entitlementKey: EntitlementKey; lifetime: boolean } | null {
  const canonicalId = canonicalProductId(productId);
  if (!canonicalId) return null;
  return PRODUCT_ENTITLEMENTS[canonicalId] ?? null;
}
