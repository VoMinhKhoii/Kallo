'use client';

import { useQuery } from '@tanstack/react-query';
import { assertBillingIdentity } from '@/lib/billing/identity';

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
  isLifetime: boolean;
  expiresAt: string | null;
  willRenew: boolean;
  source: string | null;
  // RC's lowercased event.store on the winning grant (app_store, play_store,
  // rc_billing, ...) — used to route the "manage subscription" deep link. null
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
  features: {
    ai_analysis: { allowed: boolean; reason: FeatureAccessReason };
  };
}

export const entitlementsKeys = {
  all: ['entitlements'] as const,
  user: (userId: string) => ['entitlements', userId] as const,
};

export async function fetchEntitlements(
  expectedUserId: string
): Promise<EntitlementsResponse> {
  const res = await fetch('/api/v1/account/entitlements', {
    cache: 'no-store',
    headers: { accept: 'application/json' },
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
  expectedUserId: string
): Promise<EntitlementsResponse> {
  const res = await fetch('/api/v1/account/entitlements/reconcile', {
    method: 'POST',
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to reconcile entitlements (${res.status})`);
  }
  const body = (await res.json()) as EntitlementsResponse;
  assertBillingIdentity(expectedUserId, body.userId);
  return body;
}

/**
 * The signed-in user's derived entitlement + trial state.
 *
 * `staleTime` is short (30s) because the tier can flip out-of-band when a
 * RevenueCat webhook lands after a purchase — the paywall's success
 * poll leans on refetches settling quickly.
 */
export function useEntitlements(userId: string | null) {
  return useQuery<EntitlementsResponse>({
    queryKey: userId ? entitlementsKeys.user(userId) : entitlementsKeys.all,
    queryFn: () => fetchEntitlements(userId as string),
    enabled: userId !== null,
    staleTime: 30 * 1000,
  });
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

export function aiAnalysisAllowed(
  data: EntitlementsResponse | undefined
): boolean {
  return data?.features.ai_analysis.allowed ?? false;
}
