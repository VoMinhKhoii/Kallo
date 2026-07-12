import type { EntitlementKey } from '@/lib/entitlements/features';

// Maps RevenueCat store product identifiers to the entitlement they grant.
// RC reports the underlying store product id (App Store / Play / Paddle) on
// each purchase; the webhook (Phase B) resolves it here to decide which grant
// to write. Lifetime products produce a grant with expiresAt = NULL.
//
// The `_web` variants are the Paddle-powered web-checkout SKUs. They are
// priced lower than the mobile IAP SKUs and their real ids are still TBD in
// the RC + Paddle dashboards — the placeholders below are wired now so the
// resolver + tests exist; swap the ids once the dashboards are configured.
export const PRODUCT_ENTITLEMENTS: Record<
  string,
  { entitlementKey: EntitlementKey; lifetime: boolean }
> = {
  // Mobile IAP (Apple / Google).
  nham_premium_monthly: { entitlementKey: 'premium', lifetime: false },
  nham_premium_annual: { entitlementKey: 'premium', lifetime: false },
  nham_premium_lifetime: { entitlementKey: 'premium', lifetime: true },
  // Web checkout (Paddle) — priced lower; ids TBD in dashboards.
  nham_premium_monthly_web: { entitlementKey: 'premium', lifetime: false },
  nham_premium_annual_web: { entitlementKey: 'premium', lifetime: false },
  nham_premium_lifetime_web: { entitlementKey: 'premium', lifetime: true },
};

export function resolveProduct(
  productId: string
): { entitlementKey: EntitlementKey; lifetime: boolean } | null {
  return PRODUCT_ENTITLEMENTS[productId] ?? null;
}
