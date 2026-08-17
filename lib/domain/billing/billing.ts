/**
 * The public entry of `lib/billing` — one module for the whole money path.
 *
 * Two sides, one contract. The PURCHASE side (`revenuecat/`) reads what the
 * provider says a customer owns and turns it into a `RevenueCatSnapshot`. The
 * GRANT side (`entitlement/`) owns `entitlement_grants` — the server's only
 * source of truth for access — and answers "may this user use this feature".
 * `revenuecat/reconciliation.ts` is the single seam where one becomes the
 * other; nothing else may write a RevenueCat-sourced grant.
 *
 * Import from here, not from the internals.
 *
 * BROWSER EXCEPTION: this entry reaches `server-only` modules, so client
 * components cannot use it. The three client-safe files are imported directly
 * instead — `@/lib/domain/billing/products`, `@/lib/domain/billing/identity`, and
 * `@/lib/domain/billing/web-purchases` (a `'use client'` module wrapping the
 * RevenueCat Web SDK, deliberately absent below so no server graph pulls a
 * browser SDK in).
 */

export type { BillingConfig } from '@/lib/domain/billing/entitlement/config';
export { getBillingConfig } from '@/lib/domain/billing/entitlement/config';
export type {
  EntitlementKey,
  FeatureKey,
  FeatureRule,
} from '@/lib/domain/billing/entitlement/features';
export { FEATURES } from '@/lib/domain/billing/entitlement/features';
export type {
  GrantMutationDeps,
  MarkGrantStatusInput,
  ReassignGrantsInput,
  SetGrantWillRenewInput,
  UpsertGrantInput,
} from '@/lib/domain/billing/entitlement/grants';
export {
  markGrantStatus,
  reassignGrants,
  setGrantWillRenew,
  upsertGrant,
} from '@/lib/domain/billing/entitlement/grants';
export type {
  EntitlementDeps,
  EntitlementInput,
  EntitlementState,
  FeatureAccess,
  FeatureAccessReason,
  FeatureAccessResult,
  Tier,
  TrialState,
} from '@/lib/domain/billing/entitlement/service';
export {
  checkFeatureAccess,
  getEntitlementState,
} from '@/lib/domain/billing/entitlement/service';
export {
  assertBillingIdentity,
  BillingIdentityMismatchError,
} from '@/lib/domain/billing/identity';
export {
  canonicalProductId,
  isAllowedMobileProduct,
  isAllowedWebProduct,
  PRODUCT_ENTITLEMENTS,
  resolveProduct,
} from '@/lib/domain/billing/products';
export type { RevenueCatClientDeps } from '@/lib/domain/billing/revenuecat/client';
export { fetchRevenueCatSnapshot } from '@/lib/domain/billing/revenuecat/client';
export { deleteRevenueCatCustomer } from '@/lib/domain/billing/revenuecat/customer';
export type { BillingEnvironment } from '@/lib/domain/billing/revenuecat/identity';
export {
  getBillingEnvironment,
  getBillingEnvironmentForUser,
  isBillingSandboxUser,
} from '@/lib/domain/billing/revenuecat/identity';
export { RevenueCatOwnershipConflictError } from '@/lib/domain/billing/revenuecat/projection';
export type {
  RevenueCatCustomerRevocation,
  RevenueCatGrantReconciliation,
  RevenueCatReconciliationDeps,
} from '@/lib/domain/billing/revenuecat/reconciliation';
export {
  reconcileRevenueCatGrantSnapshots,
  reconcileRevenueCatGrants,
} from '@/lib/domain/billing/revenuecat/reconciliation';
export type {
  RevenueCatGrantSnapshot,
  RevenueCatSnapshot,
} from '@/lib/domain/billing/revenuecat/snapshot';
export { parseRevenueCatSnapshot } from '@/lib/domain/billing/revenuecat/snapshot';
