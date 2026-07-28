import { describe, expect, it } from 'vitest';
import {
  isAllowedMobileProduct,
  isAllowedWebProduct,
  resolveProduct,
} from '../products';

describe('resolveProduct', () => {
  it('normalizes modern Google Play subscription:base-plan identifiers', () => {
    expect(resolveProduct('kallo_premium_monthly:monthly')).toEqual({
      entitlementKey: 'premium',
      lifetime: false,
    });
  });

  it('does not guess unknown or cross-cadence base plans', () => {
    expect(resolveProduct('unknown:annual')).toBeNull();
    expect(resolveProduct('kallo_premium_monthly:annual')).toBeNull();
    expect(resolveProduct('kallo_premium_annual:monthly')).toBeNull();
    expect(resolveProduct('kallo_premium_lifetime:annual')).toBeNull();
  });
});

describe('billing product allowlists', () => {
  it('uses one canonical catalog and only exact Google base plans', () => {
    expect(isAllowedWebProduct('kallo_premium_annual')).toBe(true);
    expect(isAllowedWebProduct('kallo_premium_annual_web')).toBe(false);
    expect(isAllowedMobileProduct('kallo_premium_annual:annual')).toBe(true);
    expect(isAllowedMobileProduct('kallo_premium_annual:monthly')).toBe(false);
    expect(isAllowedMobileProduct('kallo_premium_lifetime:annual')).toBe(false);
  });
});
