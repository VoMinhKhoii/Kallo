import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  aiAnalysisAllowed,
  type EntitlementsResponse,
  entitlementsKeys,
  fetchEntitlements,
  isPremium,
  trialDaysRemaining,
} from '@/hooks/billing/use-entitlements';
import { BillingIdentityMismatchError } from '@/lib/billing/identity';

function make(
  overrides: Partial<EntitlementsResponse> = {}
): EntitlementsResponse {
  return {
    userId: 'user-a',
    purchasesEnabled: false,
    tier: 'free',
    isLifetime: false,
    expiresAt: null,
    willRenew: false,
    source: null,
    store: null,
    managementUrl: null,
    managementStore: null,
    hasActiveSubscription: false,
    trial: { active: false, endsAt: null, daysRemaining: 0 },
    features: { ai_analysis: { allowed: false, reason: 'not_entitled' } },
    ...overrides,
  };
}

describe('entitlement selectors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('scopes cached entitlement state to the authenticated user', () => {
    expect(entitlementsKeys.user('user-a')).toEqual(['entitlements', 'user-a']);
    expect(entitlementsKeys.user('user-a')).not.toEqual(
      entitlementsKeys.user('user-b')
    );
  });

  it('rejects a response authenticated as a different user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(make({ userId: 'user-b', tier: 'premium' }))
      )
    );

    await expect(fetchEntitlements('user-a')).rejects.toBeInstanceOf(
      BillingIdentityMismatchError
    );
  });

  it('isPremium is true only for the premium tier', () => {
    expect(isPremium(make({ tier: 'premium' }))).toBe(true);
    expect(isPremium(make({ tier: 'free' }))).toBe(false);
    expect(isPremium(undefined)).toBe(false);
  });

  it('trialDaysRemaining returns 0 when the trial is inactive', () => {
    expect(
      trialDaysRemaining(
        make({ trial: { active: true, endsAt: null, daysRemaining: 4 } })
      )
    ).toBe(4);
    expect(
      trialDaysRemaining(
        make({ trial: { active: false, endsAt: null, daysRemaining: 4 } })
      )
    ).toBe(0);
    expect(trialDaysRemaining(undefined)).toBe(0);
  });

  it('aiAnalysisAllowed mirrors the feature flag, defaulting to false', () => {
    expect(
      aiAnalysisAllowed(
        make({
          features: { ai_analysis: { allowed: true, reason: 'trial' } },
        })
      )
    ).toBe(true);
    expect(aiAnalysisAllowed(make())).toBe(false);
    expect(aiAnalysisAllowed(undefined)).toBe(false);
  });
});
