import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  aiAnalysisAllowed,
  type EntitlementsResponse,
  entitlementsKeys,
  featureAllowed,
  featureLocked,
  fetchEntitlements,
  isPremium,
  trialDaysRemaining,
} from '@/lib/domain/billing/entitlements-client';
import { BillingIdentityMismatchError } from '@/lib/domain/billing/identity';

function makeFeatures(
  allowed: boolean,
  reason: 'entitled' | 'trial' | 'trial_expired' | 'not_entitled'
): EntitlementsResponse['features'] {
  return {
    ai_analysis: { allowed, reason },
    label_scan: { allowed, reason },
    micronutrients: { allowed, reason },
    relog: { allowed, reason },
    cheat_meal: { allowed, reason },
    copy_split: { allowed, reason },
    unlimited_circle: { allowed, reason },
  };
}

function make(
  overrides: Partial<EntitlementsResponse> = {}
): EntitlementsResponse {
  return {
    userId: 'user-a',
    purchasesEnabled: false,
    enforcementEnabled: true,
    tier: 'free',
    reconciliationRequired: false,
    isLifetime: false,
    expiresAt: null,
    willRenew: false,
    source: null,
    store: null,
    managementUrl: null,
    managementStore: null,
    hasActiveSubscription: false,
    trial: { active: false, endsAt: null, daysRemaining: 0 },
    features: makeFeatures(false, 'not_entitled'),
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
      aiAnalysisAllowed(make({ features: makeFeatures(true, 'trial') }))
    ).toBe(true);
    expect(aiAnalysisAllowed(make())).toBe(false);
    expect(aiAnalysisAllowed(undefined)).toBe(false);
  });

  it('featureAllowed reads any feature, defaulting to false', () => {
    const allowed = make({ features: makeFeatures(true, 'entitled') });
    expect(featureAllowed(allowed, 'micronutrients')).toBe(true);
    expect(featureAllowed(allowed, 'unlimited_circle')).toBe(true);
    expect(featureAllowed(make(), 'relog')).toBe(false);
    expect(featureAllowed(undefined, 'relog')).toBe(false);
  });

  it('featureLocked is true only when enforcement is on AND access denied', () => {
    expect(featureLocked(make(), 'relog')).toBe(true);
    expect(
      featureLocked(make({ features: makeFeatures(true, 'trial') }), 'relog')
    ).toBe(false);
  });

  it('featureLocked never locks while enforcement is off', () => {
    const killSwitchOff = make({ enforcementEnabled: false });
    expect(featureLocked(killSwitchOff, 'relog')).toBe(false);
    expect(featureLocked(killSwitchOff, 'label_scan')).toBe(false);
  });

  it('featureLocked fails open on undefined data', () => {
    expect(featureLocked(undefined, 'cheat_meal')).toBe(false);
  });
});
