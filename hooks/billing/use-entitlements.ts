'use client';

import { useQuery } from '@tanstack/react-query';

/** Feature-gate reasons mirrored from the server entitlement service. */
export type FeatureAccessReason =
  | 'entitled'
  | 'trial'
  | 'trial_expired'
  | 'not_entitled';

/** Shape of GET /api/v1/account/entitlements (the fixed server contract). */
export interface EntitlementsResponse {
  tier: 'free' | 'premium';
  isLifetime: boolean;
  expiresAt: string | null;
  willRenew: boolean;
  source: string | null;
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
};

async function fetchEntitlements(): Promise<EntitlementsResponse> {
  const res = await fetch('/api/v1/account/entitlements', {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to load entitlements (${res.status})`);
  }
  return res.json();
}

/**
 * The signed-in user's derived entitlement + trial state.
 *
 * `staleTime` is short (30s) because the tier can flip out-of-band when a
 * RevenueCat/Paddle webhook lands after a purchase — the paywall's success
 * poll leans on refetches settling quickly.
 */
export function useEntitlements() {
  return useQuery<EntitlementsResponse>({
    queryKey: entitlementsKeys.all,
    queryFn: fetchEntitlements,
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
