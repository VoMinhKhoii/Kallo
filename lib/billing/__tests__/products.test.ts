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

  it('resolves the Paddle price ids RevenueCat imports as product ids', () => {
    expect(resolveProduct('pri_01kyy23rh7qjch1798kfwqx8x8')).toEqual({
      entitlementKey: 'premium',
      lifetime: false,
    });
    expect(resolveProduct('pri_01kyy258p8ay94vzvyznz6k9r0')).toEqual({
      entitlementKey: 'premium',
      lifetime: false,
    });
    // One-time Paddle price — must project a never-expiring grant.
    expect(resolveProduct('pri_01kyy26yps3tt1zf1vjhhcvkp8')).toEqual({
      entitlementKey: 'premium',
      lifetime: true,
    });
  });

  it('resolves the production Paddle price ids', () => {
    // Production is a separate Paddle account with its own price ids. An id
    // missing here means a real customer pays and the grant is dropped, so
    // these assertions are the only thing standing between a launch-day
    // catalog typo and silent revenue loss.
    expect(resolveProduct('pri_01kz49s9hjsmk53evgrsh55ccr')).toEqual({
      entitlementKey: 'premium',
      lifetime: false,
    });
    expect(resolveProduct('pri_01kz49s9jm5m5xhzwktnz4005q')).toEqual({
      entitlementKey: 'premium',
      lifetime: false,
    });
    expect(resolveProduct('pri_01kz49s9kxp82v1r03caxc1gqh')).toEqual({
      entitlementKey: 'premium',
      lifetime: true,
    });
  });

  it('keeps sandbox and production price ids distinct', () => {
    // Both accounts are in one map, so a copy-paste that pointed a production
    // id at the wrong plan would still resolve and still look correct here.
    // Pin the mapping by asserting the pairs differ across environments.
    const sandbox = [
      'pri_01kyy23rh7qjch1798kfwqx8x8',
      'pri_01kyy258p8ay94vzvyznz6k9r0',
      'pri_01kyy26yps3tt1zf1vjhhcvkp8',
    ];
    const production = [
      'pri_01kz49s9hjsmk53evgrsh55ccr',
      'pri_01kz49s9jm5m5xhzwktnz4005q',
      'pri_01kz49s9kxp82v1r03caxc1gqh',
    ];
    expect(new Set([...sandbox, ...production]).size).toBe(6);
    for (const [index, id] of production.entries()) {
      expect(resolveProduct(id)).toEqual(resolveProduct(sandbox[index]));
    }
  });

  it('refuses a Paddle price id that is not in the catalog', () => {
    // Opaque ids are easy to mistranscribe (the monthly id ends `x8x8`, which
    // renders as `8×8` in some fonts). A near-miss must grant nothing.
    expect(resolveProduct('pri_01kyy23rh7qjch1798kfwqx8x9')).toBeNull();
    expect(resolveProduct('pri_neverseen')).toBeNull();
  });
});

describe('billing product allowlists', () => {
  it('uses one canonical catalog and only exact Google base plans', () => {
    expect(isAllowedWebProduct('kallo_premium_annual')).toBe(true);
    expect(isAllowedWebProduct('kallo_premium_annual_web')).toBe(false);
    // The paywall filters offering packages on this; a Paddle-imported
    // package would be silently hidden if the price id were not allowed.
    expect(isAllowedWebProduct('pri_01kyy258p8ay94vzvyznz6k9r0')).toBe(true);
    expect(isAllowedWebProduct('pri_01kyy258p8ay94vzvyznz6k9r1')).toBe(false);
    // Paddle prices are web-only; they must not widen the mobile allowlist.
    expect(isAllowedMobileProduct('pri_01kyy258p8ay94vzvyznz6k9r0')).toBe(
      false
    );
    expect(isAllowedMobileProduct('kallo_premium_annual:annual')).toBe(true);
    expect(isAllowedMobileProduct('kallo_premium_annual:monthly')).toBe(false);
    expect(isAllowedMobileProduct('kallo_premium_lifetime:annual')).toBe(false);
  });
});
