// What each plan's button on /pricing does for a signed-in visitor.
//
// Pure: the entitlement and offering queries live in the checkout provider
// (`components/landing-page/pricing/checkout/`), which feeds their results in.

import { canonicalProductId, PRODUCT_IDS } from '@/lib/domain/billing/products';
import type { Package } from '@/lib/domain/billing/web-purchases';
import type { BillingPeriod } from './web-prices';

/**
 * - `sign-up`: signed out — the button opens the sign-up dialog.
 * - `loading`: the entitlement or the offering has not arrived.
 * - `buy`: a package for this period is on sale — the button checks out.
 * - `current`: the visitor already has this plan.
 * - `closed`: the commerce switch (`purchasesEnabled`) is off.
 * - `failed`: the entitlement or the offering could not be read, or the
 *   offering carries no package for this period.
 */
export type PremiumCtaState =
  | 'sign-up'
  | 'loading'
  | 'buy'
  | 'current'
  | 'closed'
  | 'failed';

/** `current` is the signed-in Free user; `none` a Premium user or unknown. */
export type FreeCtaState = 'sign-up' | 'current' | 'none';

const PRODUCT_FOR: Record<BillingPeriod, string> = {
  monthly: PRODUCT_IDS.monthly,
  yearly: PRODUCT_IDS.annual,
};

/** The offering package that sells this period, or null when none does. */
export function packageForPeriod(
  packages: readonly Package[],
  period: BillingPeriod
): Package | null {
  return (
    packages.find(
      (pkg) =>
        canonicalProductId(pkg.webBillingProduct.identifier) ===
        PRODUCT_FOR[period]
    ) ?? null
  );
}

export interface CheckoutInputs {
  tier: 'free' | 'premium' | null;
  purchasesEnabled: boolean | null;
  entitlementsFailed: boolean;
  offeringsPending: boolean;
  offeringsFailed: boolean;
  hasPackage: boolean;
}

export function premiumCtaState(input: CheckoutInputs): PremiumCtaState {
  if (input.entitlementsFailed) return 'failed';
  if (input.tier === null || input.purchasesEnabled === null) return 'loading';
  if (input.tier === 'premium') return 'current';
  if (!input.purchasesEnabled) return 'closed';
  if (input.offeringsFailed) return 'failed';
  if (input.offeringsPending) return 'loading';
  return input.hasPackage ? 'buy' : 'failed';
}

export function freeCtaState(tier: 'free' | 'premium' | null): FreeCtaState {
  return tier === 'free' ? 'current' : 'none';
}
