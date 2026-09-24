// What Premium costs on the web for ONE visitor, and how the pricing card
// prints it. Two sources resolve into this shape: Paddle's price preview for
// a signed-out visitor (`paddle-preview.ts`) and the RevenueCat offering a
// signed-in visitor's checkout uses (`offering-prices.ts`).

/** The two ways to pay for Premium on the web. */
export type BillingPeriod = 'yearly' | 'monthly';

/** An amount in MAJOR units (dollars, đồng) and its ISO currency. */
export interface Money {
  amount: number;
  currency: string;
}

export type WebPrices = Record<BillingPeriod, Money> & {
  /** The paid first week, or null when the price has none for this market. */
  intro: { price: Money; days: number } | null;
};

/** Days in one unit of a billing or trial period, as both sources count them. */
export const PERIOD_DAYS: Record<'day' | 'week' | 'month' | 'year', number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

// Currencies with no minor unit.
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'CLP', 'VND']);

export function isZeroDecimal(currency: string): boolean {
  return ZERO_DECIMAL.has(currency);
}

/** "$7.99", "49.000 ₫" — the visitor's language, the market's currency. */
export function formatMoney(money: Money, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    maximumFractionDigits: isZeroDecimal(money.currency) ? 0 : 2,
  }).format(money.amount);
}

/**
 * The yearly saving against twelve monthly payments, rounded; null if none.
 * A missing or mistyped amount (NaN, a zero monthly rate) is no saving too:
 * "Save NaN%" beside a real price is worse than no chip at all.
 */
export function yearlySavePercent({
  monthly,
  yearly,
}: Record<BillingPeriod, Money>): number | null {
  const twelve = monthly.amount * 12;
  if (!(twelve > 0) || yearly.currency !== monthly.currency) return null;
  const percent = Math.round((1 - yearly.amount / twelve) * 100);
  return Number.isFinite(percent) && percent > 0 ? percent : null;
}
