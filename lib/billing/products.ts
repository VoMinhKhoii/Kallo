import type { EntitlementKey } from '@/lib/entitlements/features';

// Maps RevenueCat store product identifiers to the entitlement they grant.
// RC reports the underlying store product id (App Store / Play / web billing) on
// each purchase; the webhook (Phase B) resolves it here to decide which grant
// to write. Lifetime products produce a grant with expiresAt = NULL.
//
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

/** Resolve only exact catalog identifiers to their canonical product id. */
export function canonicalProductId(productId: string): string | null {
  if (CANONICAL_PRODUCT_IDS.has(productId)) return productId;
  return GOOGLE_BASE_PLAN_PRODUCTS[productId] ?? null;
}

export function isAllowedWebProduct(productId: string): boolean {
  return CANONICAL_PRODUCT_IDS.has(productId);
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
