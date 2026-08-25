import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  aiAnalysisAllowed,
  applyEntitlementSnapshot,
  type EntitlementsResponse,
  entitlementsKeys,
  featureAllowed,
  featureLocked,
  fetchEntitlements,
  isPremium,
  trialDaysRemaining,
} from '@/lib/domain/billing/entitlements-client';
import { BillingIdentityMismatchError } from '@/lib/domain/billing/identity';
import { nutritionKeys } from '@/lib/domain/nutrition/query-keys';

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

describe('applyEntitlementSnapshot', () => {
  function harness(prev?: EntitlementsResponse) {
    const queryClient = new QueryClient();
    if (prev) queryClient.setQueryData(entitlementsKeys.user('user-a'), prev);
    const setQueryData = vi.spyOn(queryClient, 'setQueryData');
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined);
    return { queryClient, setQueryData, invalidateQueries };
  }

  it('caches the snapshot without invalidating when the tier is unchanged', () => {
    // The checkout poll writes every 2s and the visibility sync writes on every
    // tab focus; invalidating on those would trash the nutrition cache.
    const { queryClient, setQueryData, invalidateQueries } = harness(
      make({ tier: 'free' })
    );
    const next = make({ tier: 'free', reconciliationRequired: true });

    applyEntitlementSnapshot(queryClient, next);

    expect(setQueryData).toHaveBeenCalledWith(
      entitlementsKeys.user('user-a'),
      next
    );
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('invalidates the nutrition cache when the tier flips free to premium', () => {
    const { queryClient, setQueryData, invalidateQueries } = harness(
      make({ tier: 'free' })
    );
    const next = make({
      tier: 'premium',
      features: makeFeatures(true, 'entitled'),
    });

    applyEntitlementSnapshot(queryClient, next);

    expect(setQueryData).toHaveBeenCalledWith(
      entitlementsKeys.user('user-a'),
      next
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: nutritionKeys.all,
    });
  });

  it('invalidates the nutrition cache when the tier flips premium to free', () => {
    const { queryClient, setQueryData, invalidateQueries } = harness(
      make({ tier: 'premium', features: makeFeatures(true, 'entitled') })
    );
    const next = make({ tier: 'free' });

    applyEntitlementSnapshot(queryClient, next);

    expect(setQueryData).toHaveBeenCalledWith(
      entitlementsKeys.user('user-a'),
      next
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: nutritionKeys.all,
    });
  });

  it('treats a first premium snapshot as a flip when nothing was cached', () => {
    // The entitlements entry has no permanent observer and can be collected
    // while a mounted nutrition query lives on. After such an eviction a real
    // free -> premium flip would otherwise leave a paying user locked.
    const { queryClient, invalidateQueries } = harness();

    applyEntitlementSnapshot(
      queryClient,
      make({ tier: 'premium', features: makeFeatures(true, 'entitled') })
    );

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: nutritionKeys.all,
    });
  });

  it('does not invalidate on a first free snapshot', () => {
    // Cold load: the nutrition overview was fetched against the same server
    // that decided this tier, so it is already correct.
    const { queryClient, setQueryData, invalidateQueries } = harness();
    const next = make({ tier: 'free' });

    applyEntitlementSnapshot(queryClient, next);

    expect(setQueryData).toHaveBeenCalledWith(
      entitlementsKeys.user('user-a'),
      next
    );
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('invalidates when a trial expires without the tier moving', () => {
    // A trial runs on the free tier with micronutrients allowed; expiry flips
    // the feature and the response SHAPE while `tier` never moves.
    const { queryClient, invalidateQueries } = harness(
      make({
        tier: 'free',
        features: makeFeatures(true, 'trial'),
        trial: { active: true, endsAt: null, daysRemaining: 1 },
      })
    );

    applyEntitlementSnapshot(
      queryClient,
      make({ tier: 'free', features: makeFeatures(false, 'trial_expired') })
    );

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: nutritionKeys.all,
    });
  });

  it('does not invalidate when a trial converts to premium', () => {
    // The tier moves but access — and therefore the overview shape — does not.
    const { queryClient, invalidateQueries } = harness(
      make({ tier: 'free', features: makeFeatures(true, 'trial') })
    );

    applyEntitlementSnapshot(
      queryClient,
      make({ tier: 'premium', features: makeFeatures(true, 'entitled') })
    );

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('scopes the write to the snapshot own user id', () => {
    const queryClient = new QueryClient();
    const next = make({ userId: 'user-b', tier: 'premium' });

    applyEntitlementSnapshot(queryClient, next);

    expect(queryClient.getQueryData(entitlementsKeys.user('user-b'))).toEqual(
      next
    );
    expect(
      queryClient.getQueryData(entitlementsKeys.user('user-a'))
    ).toBeUndefined();
  });
});
