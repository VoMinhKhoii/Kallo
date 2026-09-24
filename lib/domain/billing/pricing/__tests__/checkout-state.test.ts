import { describe, expect, it } from 'vitest';
import type { Package } from '@/lib/domain/billing/web-purchases';
import {
  type CheckoutInputs,
  freeCtaState,
  packageForPeriod,
  premiumCtaState,
} from '../checkout-state';

function pkg(identifier: string): Package {
  return {
    identifier: `$rc_${identifier}`,
    webBillingProduct: { identifier },
  } as unknown as Package;
}

const READY: CheckoutInputs = {
  tier: 'free',
  purchasesEnabled: true,
  entitlementsFailed: false,
  offeringsPending: false,
  offeringsFailed: false,
  hasPackage: true,
};

describe('packageForPeriod', () => {
  // Paddle-backed offerings report opaque `pri_…` ids; the catalog maps them.
  const packages = [
    pkg('pri_01kz49s9hjsmk53evgrsh55ccr'),
    pkg('pri_01kz49s9jm5m5xhzwktnz4005q'),
  ];

  it('picks the annual product for Yearly and the monthly one for Monthly', () => {
    expect(packageForPeriod(packages, 'yearly')).toBe(packages[1]);
    expect(packageForPeriod(packages, 'monthly')).toBe(packages[0]);
  });

  it('is null when the offering does not sell the period', () => {
    expect(packageForPeriod([packages[0]], 'yearly')).toBeNull();
  });
});

describe('premiumCtaState', () => {
  it('buys when a Free user can purchase this period', () => {
    expect(premiumCtaState(READY)).toBe('buy');
  });

  it('waits for the entitlement, then the offering', () => {
    expect(premiumCtaState({ ...READY, tier: null })).toBe('loading');
    expect(premiumCtaState({ ...READY, offeringsPending: true })).toBe(
      'loading'
    );
  });

  it('is the current plan for a subscriber', () => {
    expect(premiumCtaState({ ...READY, tier: 'premium' })).toBe('current');
  });

  it('is closed while purchases are switched off, before any offering read', () => {
    expect(
      premiumCtaState({
        ...READY,
        purchasesEnabled: false,
        offeringsPending: true,
      })
    ).toBe('closed');
  });

  it('fails on a read error or a missing package', () => {
    expect(premiumCtaState({ ...READY, entitlementsFailed: true })).toBe(
      'failed'
    );
    expect(premiumCtaState({ ...READY, offeringsFailed: true })).toBe('failed');
    expect(premiumCtaState({ ...READY, hasPackage: false })).toBe('failed');
  });
});

describe('freeCtaState', () => {
  it('marks Free as current only for a Free user', () => {
    expect(freeCtaState('free')).toBe('current');
    expect(freeCtaState('premium')).toBe('none');
    expect(freeCtaState(null)).toBe('none');
  });
});
