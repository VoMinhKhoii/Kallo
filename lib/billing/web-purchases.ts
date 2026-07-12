'use client';

import {
  ErrorCode,
  type Offering,
  type Package,
  Purchases,
  PurchasesError,
} from '@revenuecat/purchases-js';

// The RevenueCat Web Billing public API key. Behind the scenes RC routes web
// checkout through Paddle, but from this SDK's perspective it is the standard
// purchases-js flow. When the key is absent (dashboards not configured yet in
// an environment) the UI must degrade gracefully instead of crashing — see
// `webPurchasesEnabled`.
const WEB_API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_WEB_API_KEY;

/** True when the Web SDK can be configured (env key present). */
export const webPurchasesEnabled = Boolean(WEB_API_KEY);

/**
 * The RC user id we last configured for. Purchases.configure is a singleton,
 * so we only (re)configure when it hasn't been set up for this exact user.
 */
let configuredUserId: string | null = null;

/**
 * Ensure the Purchases singleton is configured for the given Supabase user id.
 * Idempotent: safe to call on every mount. Returns the shared instance, or
 * null when the SDK is disabled (no env key).
 */
function ensureConfigured(appUserId: string): Purchases | null {
  if (!WEB_API_KEY) return null;

  if (Purchases.isConfigured() && configuredUserId === appUserId) {
    return Purchases.getSharedInstance();
  }

  const instance = Purchases.configure({
    apiKey: WEB_API_KEY,
    appUserId,
  });
  configuredUserId = appUserId;
  return instance;
}

/**
 * Fetch the current offering's packages for the paywall. Returns null when the
 * SDK is disabled or RC has no current offering configured — callers render a
 * "purchases unavailable" state rather than an error.
 */
export async function getOfferings(
  appUserId: string
): Promise<Offering | null> {
  const purchases = ensureConfigured(appUserId);
  if (!purchases) return null;
  const { current } = await purchases.getOfferings();
  return current ?? null;
}

/** Outcome of a purchase attempt, discriminated so the UI can branch cleanly. */
export type PurchaseResult =
  | { status: 'success' }
  | { status: 'cancelled' }
  | { status: 'already_owned' };

/**
 * Present the checkout UI for a package. Resolves for the expected non-error
 * outcomes (success, user cancellation, already-owned) and rethrows only real
 * failures so the caller can surface a destructive toast.
 */
export async function purchasePackage(
  appUserId: string,
  rcPackage: Package,
  options?: { customerEmail?: string; selectedLocale?: string }
): Promise<PurchaseResult> {
  const purchases = ensureConfigured(appUserId);
  if (!purchases) {
    throw new Error('Web purchases are not configured.');
  }

  try {
    await purchases.purchase({
      rcPackage,
      customerEmail: options?.customerEmail,
      selectedLocale: options?.selectedLocale,
    });
    return { status: 'success' };
  } catch (error) {
    if (error instanceof PurchasesError) {
      if (error.errorCode === ErrorCode.UserCancelledError) {
        return { status: 'cancelled' };
      }
      if (error.errorCode === ErrorCode.ProductAlreadyPurchasedError) {
        return { status: 'already_owned' };
      }
    }
    throw error;
  }
}

export type { Offering, Package };
