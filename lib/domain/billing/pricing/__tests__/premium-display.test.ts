import { describe, expect, it } from 'vitest';
import { type PremiumFallback, premiumDisplay } from '../premium-display';
import type { WebPrices } from '../web-prices';

const EN_FALLBACK: PremiumFallback = {
  priceMonthly: '$7.99',
  priceYearly: '$2.50',
  billedMonthly: '$7.99',
  billedYearly: '$29.99',
  introPrice: '$0.89',
  introDays: 7,
  amountMonthly: 7.99,
  amountYearly: 29.99,
};

const VN_LIVE: WebPrices = {
  monthly: { amount: 49000, currency: 'VND' },
  yearly: { amount: 449000, currency: 'VND' },
  intro: { price: { amount: 7999, currency: 'VND' }, days: 7 },
};

const US_LIVE: WebPrices = {
  monthly: { amount: 7.99, currency: 'USD' },
  yearly: { amount: 29.99, currency: 'USD' },
  intro: { price: { amount: 0.89, currency: 'USD' }, days: 7 },
};

describe('premiumDisplay — message fallbacks', () => {
  it('quotes the yearly plan per month, bills the year, and computes the saving', () => {
    expect(premiumDisplay('yearly', undefined, 'en', EN_FALLBACK)).toEqual({
      price: '$2.50',
      billed: '$29.99',
      intro: { price: '$0.89', days: 7 },
      savePercent: 69,
    });
  });

  it('has no saving on Monthly', () => {
    expect(premiumDisplay('monthly', null, 'en', EN_FALLBACK)).toEqual({
      price: '$7.99',
      billed: '$7.99',
      intro: { price: '$0.89', days: 7 },
      savePercent: null,
    });
  });

  it('computes 24% from the đồng amounts', () => {
    const vi = { ...EN_FALLBACK, amountMonthly: 49000, amountYearly: 449000 };
    expect(premiumDisplay('yearly', null, 'vi', vi).savePercent).toBe(24);
  });

  it('drops the saving rather than print NaN for a broken amount', () => {
    const broken = { ...EN_FALLBACK, amountMonthly: Number.NaN };
    expect(premiumDisplay('yearly', null, 'en', broken).savePercent).toBeNull();
  });
});

describe('premiumDisplay — live Paddle prices', () => {
  it('formats the visitor market in the page language', () => {
    expect(premiumDisplay('yearly', US_LIVE, 'en', EN_FALLBACK)).toEqual({
      price: '$2.50',
      billed: '$29.99',
      intro: { price: '$0.89', days: 7 },
      savePercent: 69,
    });
  });

  it('prices a Vietnamese buyer in đồng whatever the page language', () => {
    const display = premiumDisplay('monthly', VN_LIVE, 'en', EN_FALLBACK);
    expect(display.billed).toContain('49,000');
    expect(display.intro?.price).toContain('7,999');
    expect(display.savePercent).toBeNull();
  });

  it('shows no first week when the market has none', () => {
    const display = premiumDisplay(
      'yearly',
      { ...US_LIVE, intro: null },
      'en',
      EN_FALLBACK
    );
    expect(display.intro).toBeNull();
  });
});
