import { describe, expect, it } from 'vitest';
import {
  aiAnalysisAllowed,
  type EntitlementsResponse,
  isPremium,
  trialDaysRemaining,
} from '@/hooks/billing/use-entitlements';

function make(
  overrides: Partial<EntitlementsResponse> = {}
): EntitlementsResponse {
  return {
    tier: 'free',
    isLifetime: false,
    expiresAt: null,
    willRenew: false,
    source: null,
    trial: { active: false, endsAt: null, daysRemaining: 0 },
    features: { ai_analysis: { allowed: false, reason: 'not_entitled' } },
    ...overrides,
  };
}

describe('entitlement selectors', () => {
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
