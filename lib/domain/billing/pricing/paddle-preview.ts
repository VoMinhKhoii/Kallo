// A signed-out visitor's Premium prices, resolved from Paddle's price preview.
// Paddle picks the market from the visitor's IP: a Vietnamese buyer gets the
// VND override whatever language the page is in, so the page must ask Paddle
// rather than read a price from the locale's message file.
//
// Pure: the Paddle.js call lives in `hooks/billing/use-web-prices.ts`.

import { z } from 'zod';
import {
  PADDLE_PRICE_IDS,
  type PaddleEnvironment,
} from '@/lib/domain/billing/products';
import {
  isZeroDecimal,
  type Money,
  PERIOD_DAYS,
  type WebPrices,
} from './web-prices';

/** The recurring plans the preview quotes, per Paddle account. */
export const WEB_PRICE_IDS: Record<
  PaddleEnvironment,
  { monthly: string; annual: string }
> = {
  sandbox: {
    monthly: PADDLE_PRICE_IDS.sandbox.monthly,
    annual: PADDLE_PRICE_IDS.sandbox.annual,
  },
  production: {
    monthly: PADDLE_PRICE_IDS.production.monthly,
    annual: PADDLE_PRICE_IDS.production.annual,
  },
};

/** Paddle client tokens carry their environment: `test_…` or `live_…`. */
export function paddleEnvironment(token: string): PaddleEnvironment | null {
  if (token.startsWith('test_')) return 'sandbox';
  if (token.startsWith('live_')) return 'production';
  return null;
}

const unitPrice = z.object({ amount: z.string(), currencyCode: z.string() });
const snakeUnitPrice = z
  .object({ amount: z.string(), currency_code: z.string() })
  .transform(({ amount, currency_code }) => ({
    amount,
    currencyCode: currency_code,
  }));

const override = z.union([
  z.object({ countryCodes: z.array(z.string()), unitPrice }),
  z
    .object({ country_codes: z.array(z.string()), unit_price: snakeUnitPrice })
    .transform((entry) => ({
      countryCodes: entry.country_codes,
      unitPrice: entry.unit_price,
    })),
]);

type UnitPrice = z.infer<typeof unitPrice>;
type Override = z.infer<typeof override>;

/**
 * A price's trial period. Paid trials are newer than paddle-js's typings and
 * its camelCase conversion: in live responses the trial's own fields stay
 * snake_case (`unit_price`, `unit_price_overrides`) while the price around
 * them is camelCase. Both spellings parse into the camelCase shape.
 */
const trialPeriod = z
  .object({
    interval: z.enum(['day', 'week', 'month', 'year']),
    frequency: z.number(),
    unitPrice: unitPrice.nullish(),
    unitPriceOverrides: z.array(override).optional(),
    unit_price: snakeUnitPrice.nullish(),
    unit_price_overrides: z.array(override).optional(),
  })
  .transform((trial) => ({
    days: trial.frequency * PERIOD_DAYS[trial.interval],
    unitPrice: trial.unitPrice ?? trial.unit_price ?? null,
    unitPriceOverrides:
      trial.unitPriceOverrides ?? trial.unit_price_overrides ?? [],
  }));

/** The slice of a Paddle.js `PricePreview` response this module reads. */
const previewSchema = z.object({
  data: z.object({
    currencyCode: z.string(),
    address: z.object({ countryCode: z.string() }).nullish(),
    details: z.object({
      lineItems: z.array(
        z.object({
          price: z.object({
            id: z.string(),
            unitPrice,
            unitPriceOverrides: z.array(override).optional(),
            trialPeriod: trialPeriod.nullish(),
          }),
        })
      ),
    }),
  }),
});

type Trial = z.infer<typeof trialPeriod>;

/**
 * The list price (before any tax Paddle adds at checkout) of each plan in the
 * visitor's market, plus the paid first week. Null when the preview does not
 * parse, is missing a plan, or the market is one Paddle auto-converts (no
 * override in the preview's currency) — the page then keeps its fallbacks.
 *
 * The recurring price comes from the PRICE, never the line totals: while a
 * price carries a paid trial, the preview's totals are the trial charge
 * ($0.89), not what the plan renews at.
 */
export function resolveWebPrices(
  preview: unknown,
  ids: { monthly: string; annual: string }
): WebPrices | null {
  const parsed = previewSchema.safeParse(preview);
  if (!parsed.success) return null;
  const { currencyCode, address, details } = parsed.data.data;
  const country = address?.countryCode ?? null;
  const price = (id: string) =>
    details.lineItems.find((item) => item.price.id === id)?.price;
  const monthly = price(ids.monthly);
  const annual = price(ids.annual);
  if (!monthly || !annual) return null;

  const market = (base: UnitPrice, overrides: Override[] | undefined) =>
    marketMoney(base, overrides, country, currencyCode);
  const monthlyMoney = market(monthly.unitPrice, monthly.unitPriceOverrides);
  const yearlyMoney = market(annual.unitPrice, annual.unitPriceOverrides);
  if (!monthlyMoney || !yearlyMoney) return null;

  return {
    monthly: monthlyMoney,
    yearly: yearlyMoney,
    intro: introFor(monthly.trialPeriod ?? null, country, currencyCode),
  };
}

// The amount this market pays: its country override, else the base price —
// but only when that is quoted in the preview's currency.
function marketMoney(
  base: UnitPrice,
  overrides: Override[] | undefined,
  country: string | null,
  currencyCode: string
): Money | null {
  const override = overrides?.find(
    (entry) => country !== null && entry.countryCodes.includes(country)
  );
  const unit = override?.unitPrice ?? base;
  if (unit.currencyCode !== currencyCode) return null;
  return {
    amount: fromLowestUnit(unit.amount, unit.currencyCode),
    currency: unit.currencyCode,
  };
}

// Both plans carry the same first week, so the monthly price speaks for both.
// A trial quoted in another currency than the plan (a market with no override
// of its own) is not shown: "$0.89, then 229 kr" is worse than no number.
function introFor(
  trial: Trial | null,
  country: string | null,
  currencyCode: string
): WebPrices['intro'] {
  if (!trial?.unitPrice) return null;
  const price = marketMoney(
    trial.unitPrice,
    trial.unitPriceOverrides,
    country,
    currencyCode
  );
  if (!price || !(price.amount > 0)) return null;
  return { price, days: trial.days };
}

// Paddle quotes amounts in the currency's lowest unit.
function fromLowestUnit(amount: string, currency: string): number {
  const value = Number(amount);
  return isZeroDecimal(currency) ? value : value / 100;
}
