'use client';

import type { FeatureKey } from '@/lib/domain/billing/entitlement/features';
import { assertBillingIdentity } from '@/lib/domain/billing/identity';

// The browser side of the entitlement contract: the response shape the two
// account endpoints return, the cache key everything scopes on, the two
// fetchers, and the pure selectors over the response. Deliberately free of
// React so the recovery loops in `activation/` can use it too — the query hook
// that subscribes to it lives in `@/hooks/billing/use-entitlements`.

/** Feature-gate reasons mirrored from the server entitlement service. */
export type FeatureAccessReason =
  | 'entitled'
  | 'trial'
  | 'trial_expired'
  | 'not_entitled';

/** Shape of GET /api/v1/account/entitlements (the fixed server contract). */
export interface EntitlementsResponse {
  userId: string;
  purchasesEnabled: boolean;
  tier: 'free' | 'premium';
  // The server detected a grant that looks like a missed renewal webhook, or a
  // projection RevenueCat has not confirmed in 24h. Only then is it worth
  // spending provider budget on the reconcile endpoint — see
  // `EntitlementLifecycleSync`.
  reconciliationRequired: boolean;
  isLifetime: boolean;
  expiresAt: string | null;
  willRenew: boolean;
  source: string | null;
  // RC's lowercased event.store on the winning grant (app_store, play_store,
  // paddle, ...) — used to route the "manage subscription" deep link. null
  // when the grant carried no store.
  store: string | null;
  managementUrl: string | null;
  managementStore: string | null;
  hasActiveSubscription: boolean;
  trial: {
    active: boolean;
    endsAt: string | null;
    daysRemaining: number;
  };
  // The BILLING_ENFORCEMENT_ENABLED kill-switch as the server sees it. With it
  // off the server gates nothing, so the client must not lock anything either
  // — `featureLocked` reads this before it reads `features`.
  enforcementEnabled: boolean;
  features: Record<
    FeatureKey,
    { allowed: boolean; reason: FeatureAccessReason }
  >;
}

export const entitlementsKeys = {
  all: ['entitlements'] as const,
  user: (userId: string) => ['entitlements', userId] as const,
};

export async function fetchEntitlements(
  expectedUserId: string,
  signal?: AbortSignal
): Promise<EntitlementsResponse> {
  const res = await fetch('/api/v1/account/entitlements', {
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal,
  });
  if (!res.ok) {
    throw new Error(`Failed to load entitlements (${res.status})`);
  }
  const body = (await res.json()) as EntitlementsResponse;
  assertBillingIdentity(expectedUserId, body.userId);
  return body;
}

/** Force a server-side RevenueCat CustomerInfo reconciliation. */
export async function reconcileEntitlements(
  expectedUserId: string,
  signal?: AbortSignal
): Promise<EntitlementsResponse> {
  const res = await fetch('/api/v1/account/entitlements/reconcile', {
    method: 'POST',
    headers: { accept: 'application/json' },
    signal,
  });
  if (!res.ok) {
    throw new Error(`Failed to reconcile entitlements (${res.status})`);
  }
  const body = (await res.json()) as EntitlementsResponse;
  assertBillingIdentity(expectedUserId, body.userId);
  return body;
}

// --- Selectors -------------------------------------------------------------
// Pure helpers over the response so components don't re-derive booleans.

export function isPremium(data: EntitlementsResponse | undefined): boolean {
  return data?.tier === 'premium';
}

export function trialDaysRemaining(
  data: EntitlementsResponse | undefined
): number {
  return data?.trial.active ? data.trial.daysRemaining : 0;
}

/** Does the server say this feature is available? Defaults to false. */
export function featureAllowed(
  data: EntitlementsResponse | undefined,
  key: FeatureKey
): boolean {
  return data?.features[key]?.allowed ?? false;
}

/**
 * Should the UI paint this feature as locked?
 *
 * Deliberately NOT `!featureAllowed(...)`: while the response is undefined the
 * answer is false (fail open — the server backstops every gate), and with
 * enforcement off the server allows everything regardless of tier, so locking
 * the UI would strand users on a feature that actually works.
 */
export function featureLocked(
  data: EntitlementsResponse | undefined,
  key: FeatureKey
): boolean {
  if (!data) return false;
  return data.enforcementEnabled && !data.features[key]?.allowed;
}

export function aiAnalysisAllowed(
  data: EntitlementsResponse | undefined
): boolean {
  return featureAllowed(data, 'ai_analysis');
}
