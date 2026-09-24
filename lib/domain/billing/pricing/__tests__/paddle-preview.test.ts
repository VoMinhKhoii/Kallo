import { describe, expect, it } from 'vitest';
import {
  paddleEnvironment,
  resolveWebPrices,
  WEB_PRICE_IDS,
} from '../paddle-preview';

const IDS = WEB_PRICE_IDS.production;

// The live price shape after the 2026-09 repricing: USD base, VN override, a
// 7-day paid trial with its own VN override.
const trial = {
  interval: 'day' as const,
  frequency: 7,
  unitPrice: { amount: '89', currencyCode: 'USD' },
  unitPriceOverrides: [
    {
      countryCodes: ['VN'],
      unitPrice: { amount: '7999', currencyCode: 'VND' },
    },
  ],
};

const US_BASE = { amount: '799', currencyCode: 'USD' };

/**
 * A preview shaped like Paddle's live answer: while a price has a paid trial,
 * the line totals are the TRIAL charge, so they are set to the trial amount
 * here on purpose — the recurring price must come from the price itself.
 */
function preview(
  country: string,
  currencyCode: string,
  monthly: { amount: string; currencyCode: string },
  annual: { amount: string; currencyCode: string },
  trialPeriod: unknown = trial
) {
  const line = (id: string, base: typeof monthly, vn: string) => ({
    price: {
      id,
      unitPrice: base,
      unitPriceOverrides: [
        {
          countryCodes: ['VN'],
          unitPrice: { amount: vn, currencyCode: 'VND' },
        },
      ],
      trialPeriod,
    },
    unitTotals: { subtotal: country === 'VN' ? '7999' : '89' },
  });
  return {
    data: {
      currencyCode,
      address: { countryCode: country },
      details: {
        lineItems: [
          line(IDS.monthly, monthly, '49000'),
          line(IDS.annual, annual, '449000'),
        ],
      },
    },
  };
}

const USD_M = US_BASE;
const USD_A = { amount: '2999', currencyCode: 'USD' };

describe('resolveWebPrices', () => {
  it('quotes a US visitor the USD list prices and the $0.89 week', () => {
    const prices = resolveWebPrices(preview('US', 'USD', USD_M, USD_A), IDS);
    expect(prices).toEqual({
      monthly: { amount: 7.99, currency: 'USD' },
      yearly: { amount: 29.99, currency: 'USD' },
      intro: { price: { amount: 0.89, currency: 'USD' }, days: 7 },
    });
  });

  it('quotes a Vietnamese visitor in đồng — VND has no minor unit', () => {
    const prices = resolveWebPrices(preview('VN', 'VND', USD_M, USD_A), IDS);
    expect(prices?.monthly).toEqual({ amount: 49000, currency: 'VND' });
    expect(prices?.yearly).toEqual({ amount: 449000, currency: 'VND' });
    expect(prices?.intro).toEqual({
      price: { amount: 7999, currency: 'VND' },
      days: 7,
    });
  });

  it('gives up on a market Paddle auto-converts (no override in its currency)', () => {
    expect(
      resolveWebPrices(preview('SE', 'SEK', USD_M, USD_A), IDS)
    ).toBeNull();
  });

  it('never reads the trial charge in the line totals as the plan price', () => {
    const prices = resolveWebPrices(preview('US', 'USD', USD_M, USD_A), IDS);
    expect(prices?.monthly.amount).toBe(7.99);
    expect(prices?.yearly.amount).toBe(29.99);
  });

  it('reads a price with no trial, or a free one, as no paid week', () => {
    expect(
      resolveWebPrices(preview('US', 'USD', USD_M, USD_A, null), IDS)?.intro
    ).toBeNull();
    const free = { interval: 'day' as const, frequency: 7, unitPrice: null };
    expect(
      resolveWebPrices(preview('US', 'USD', USD_M, USD_A, free), IDS)?.intro
    ).toBeNull();
  });

  it('reads the paid week in the snake_case shape live Paddle.js returns', () => {
    // Captured from the live preview: the price is camelCase, its trial is not.
    const live = {
      interval: 'day' as const,
      frequency: 7,
      unit_price: { amount: '89', currency_code: 'USD' },
      unit_price_overrides: [
        {
          country_codes: ['VN'],
          unit_price: { amount: '7999', currency_code: 'VND' },
        },
      ],
    };
    const vn = resolveWebPrices(preview('VN', 'VND', USD_M, USD_A, live), IDS);
    expect(vn?.intro).toEqual({
      price: { amount: 7999, currency: 'VND' },
      days: 7,
    });
    const us = resolveWebPrices(preview('US', 'USD', USD_M, USD_A, live), IDS);
    expect(us?.intro?.price).toEqual({ amount: 0.89, currency: 'USD' });
  });

  it('gives up on a preview that does not parse', () => {
    expect(resolveWebPrices(undefined, IDS)).toBeNull();
    expect(resolveWebPrices({ data: { currencyCode: 'USD' } }, IDS)).toBeNull();
    const badTrial = { interval: 'fortnight', frequency: 1, unitPrice: null };
    expect(
      resolveWebPrices(preview('US', 'USD', USD_M, USD_A, badTrial), IDS)
    ).toBeNull();
  });

  it('gives up when the preview is missing a plan', () => {
    const partial = preview('US', 'USD', USD_M, USD_A);
    partial.data.details.lineItems.pop();
    expect(resolveWebPrices(partial, IDS)).toBeNull();
  });
});

describe('paddleEnvironment', () => {
  it('reads the environment off the client token prefix', () => {
    expect(paddleEnvironment('test_abc')).toBe('sandbox');
    expect(paddleEnvironment('live_abc')).toBe('production');
    expect(paddleEnvironment('pdl_abc')).toBeNull();
  });
});
