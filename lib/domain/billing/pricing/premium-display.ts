// What the Premium pricing card prints for one billing period: the per-month
// hero, the amount actually billed, the paid first week and the yearly saving.
//
// Live Paddle prices win when they have arrived; until then (or without a
// Paddle token, or when Paddle is unreachable) the message-file fallbacks
// stand in, so the card never waits on a third party to say what it costs.

import {
  type BillingPeriod,
  formatMoney,
  type WebPrices,
  yearlySavePercent,
} from './web-prices';

/** The locale's display fallbacks, from `landing.pricing.plans.premium`. */
export interface PremiumFallback {
  /** Hero for Monthly, e.g. "$7.99". */
  priceMonthly: string;
  /** Hero for Yearly — the annual price per month, e.g. "$2.50". */
  priceYearly: string;
  billedMonthly: string;
  billedYearly: string;
  introPrice: string;
  introDays: number;
  /** Bare billed amounts, for the computed saving. */
  amountMonthly: number;
  amountYearly: number;
}

export interface PremiumDisplay {
  /** The per-month hero. */
  price: string;
  /** What each renewal charges for this period. */
  billed: string;
  /** The paid first week, or null when this market has none. */
  intro: { price: string; days: number } | null;
  /** Yearly only: the saving against twelve monthly payments. */
  savePercent: number | null;
}

export function premiumDisplay(
  period: BillingPeriod,
  live: WebPrices | null | undefined,
  locale: string,
  fallback: PremiumFallback
): PremiumDisplay {
  const yearly = period === 'yearly';
  if (live) {
    const billed = live[period];
    const perMonth = yearly
      ? { amount: billed.amount / 12, currency: billed.currency }
      : billed;
    return {
      price: formatMoney(perMonth, locale),
      billed: formatMoney(billed, locale),
      intro: live.intro
        ? {
            price: formatMoney(live.intro.price, locale),
            days: live.intro.days,
          }
        : null,
      savePercent: yearly ? yearlySavePercent(live) : null,
    };
  }

  return {
    price: yearly ? fallback.priceYearly : fallback.priceMonthly,
    billed: yearly ? fallback.billedYearly : fallback.billedMonthly,
    intro: { price: fallback.introPrice, days: fallback.introDays },
    savePercent: yearly
      ? yearlySavePercent({
          monthly: inLocaleCurrency(fallback.amountMonthly),
          yearly: inLocaleCurrency(fallback.amountYearly),
        })
      : null,
  };
}

// The fallback amounts are bare numbers in the locale's one currency, so they
// share a placeholder currency for the comparison.
function inLocaleCurrency(amount: number) {
  return { amount, currency: '' };
}
