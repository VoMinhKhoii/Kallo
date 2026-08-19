'use client';

import {
  ErrorCode,
  type Offering,
  type Package,
  Purchases,
  PurchasesError,
} from '@revenuecat/purchases-js';
import { assertBillingIdentity } from '@/lib/domain/billing/identity';

// The RevenueCat Web SDK public API key. Behind the scenes RC routes web
// checkout through Paddle, which is the billing engine and merchant of record;
// from this SDK's perspective it is the standard purchases-js flow and the same
// key works whichever engine backs it. When the key is absent (dashboards not
// configured yet in an environment) the UI must degrade gracefully instead of
// crashing — see `webPurchasesEnabled`.
let instance: Purchases | null = null;
let configuredUserId: string | null = null;
let configuredApiKey: string | null = null;

async function getRuntimeApiKey(appUserId: string): Promise<string | null> {
  const response = await fetch('/api/v1/account/billing-config', {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error('Could not load billing configuration.');
  }
  const body = (await response.json()) as {
    userId?: unknown;
    purchasesEnabled: boolean;
    available: boolean;
    apiKey: string | null;
  };
  assertBillingIdentity(appUserId, body.userId);
  return body.purchasesEnabled && body.available ? body.apiKey : null;
}

/**
 * Ensure the Purchases singleton is configured for the given Supabase user id.
 * Idempotent: safe to call on every mount. Returns the shared instance, or
 * null when the SDK is disabled (no env key).
 */
async function ensureConfiguredUnlocked(
  appUserId: string
): Promise<Purchases | null> {
  const apiKey = await getRuntimeApiKey(appUserId);
  if (!apiKey) return null;
  if (!instance) {
    instance = Purchases.configure({ apiKey, appUserId });
    configuredUserId = appUserId;
    configuredApiKey = apiKey;
    return instance;
  }
  if (configuredApiKey !== apiKey) {
    throw new Error(
      'Billing configuration changed. Refresh before purchasing.'
    );
  }
  if (configuredUserId !== appUserId) {
    await instance.changeUser(appUserId);
    configuredUserId = appUserId;
  }
  return instance;
}

/** Shared operation mutex. Exported so ordering can be verified without a store. */
export function createSerializedBillingRunner() {
  let queue: Promise<void> = Promise.resolve();
  return function run<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.catch(() => undefined).then(operation);
    queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };
}

const runSerialized = createSerializedBillingRunner();

/**
 * Fetch the current offering's packages for the paywall. Returns null when the
 * SDK is disabled or RC has no current offering configured — callers render a
 * "purchases unavailable" state rather than an error.
 */
export async function getOfferings(
  appUserId: string
): Promise<Offering | null> {
  return runSerialized(async () => {
    const purchases = await ensureConfiguredUnlocked(appUserId);
    if (!purchases) return null;
    const { current } = await purchases.getOfferings();
    return current ?? null;
  });
}

/** Outcome of a purchase attempt, discriminated so the UI can branch cleanly. */
export type PurchaseResult =
  | { status: 'success' }
  | { status: 'cancelled' }
  | { status: 'payment_pending' }
  | { status: 'already_owned' };

/**
 * Present the checkout UI for a package. Resolves for the expected non-error
 * outcomes (success, user cancellation, already-owned) and rethrows only real
 * failures so the caller can surface a destructive toast.
 */
export async function purchasePackage(
  appUserId: string,
  rcPackage: Package,
  options?: { selectedLocale?: string }
): Promise<PurchaseResult> {
  return runSerialized(async () => {
    const purchases = await ensureConfiguredUnlocked(appUserId);
    if (!purchases) {
      throw new Error('Web purchases are not configured.');
    }

    try {
      await purchases.purchase({
        rcPackage,
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
        if (error.errorCode === ErrorCode.PaymentPendingError) {
          return { status: 'payment_pending' };
        }
      }
      throw error;
    }
  });
}

export type { Offering, Package };
