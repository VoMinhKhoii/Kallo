import { describe, expect, it } from 'vitest';
import type { Package } from '@/lib/domain/billing/web-purchases';
import { pricesFromPackages } from '../offering-prices';

describe('pricesFromPackages', () => {
  const money = (micros: number, currency: string) => ({
    amountMicros: micros,
    currency,
  });
  function priced(
    identifier: string,
    price: { amountMicros: number; currency: string },
    intro?: { price: { amountMicros: number; currency: string }; unit: string }
  ): Package {
    return {
      identifier: `$rc_${identifier}`,
      webBillingProduct: {
        identifier,
        price,
        introPricePhase: intro
          ? { price: intro.price, period: { number: 1, unit: intro.unit } }
          : null,
        freeTrialPhase: null,
      },
    } as unknown as Package;
  }
  const M = 'pri_01kz49s9hjsmk53evgrsh55ccr';
  const A = 'pri_01kz49s9jm5m5xhzwktnz4005q';

  it("reads the buyer's own prices and paid week off the offering", () => {
    const week = { price: money(7_999e6, 'VND'), unit: 'week' };
    expect(
      pricesFromPackages([
        priced(M, money(49_000e6, 'VND'), week),
        priced(A, money(449_000e6, 'VND'), week),
      ])
    ).toEqual({
      monthly: { amount: 49000, currency: 'VND' },
      yearly: { amount: 449000, currency: 'VND' },
      intro: { price: { amount: 7999, currency: 'VND' }, days: 7 },
    });
  });

  it('has no paid week when the offering carries none', () => {
    const prices = pricesFromPackages([
      priced(M, money(7.99e6, 'USD')),
      priced(A, money(29.99e6, 'USD')),
    ]);
    expect(prices?.monthly).toEqual({ amount: 7.99, currency: 'USD' });
    expect(prices?.intro).toBeNull();
  });

  it('is null until both plans are in the offering', () => {
    expect(pricesFromPackages([priced(M, money(7.99e6, 'USD'))])).toBeNull();
    expect(pricesFromPackages([])).toBeNull();
  });
});
