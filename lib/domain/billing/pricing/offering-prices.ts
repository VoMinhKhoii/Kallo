// A signed-in visitor's Premium prices, read off the RevenueCat offering that
// their checkout will use — so the page never boots a second Paddle.js (the
// price preview's) beside the one RevenueCat runs for checkout.

import type { Price, PricingPhase } from '@revenuecat/purchases-js';
import type { Package } from '@/lib/domain/billing/web-purchases';
import { packageForPeriod } from './checkout-state';
import { type Money, PERIOD_DAYS, type WebPrices } from './web-prices';

function micros(price: Price): Money {
  return { amount: price.amountMicros / 1e6, currency: price.currency };
}

// The paid week is the product's introductory phase; a free phase is not a
// paid week.
function introFor(phase: PricingPhase | null): WebPrices['intro'] {
  if (!phase?.price || !(phase.price.amountMicros > 0) || !phase.period) {
    return null;
  }
  const unit = PERIOD_DAYS[phase.period.unit];
  if (!unit) return null;
  return { price: micros(phase.price), days: phase.period.number * unit };
}

export function pricesFromPackages(
  packages: readonly Package[]
): WebPrices | null {
  const monthly = packageForPeriod(packages, 'monthly')?.webBillingProduct;
  const yearly = packageForPeriod(packages, 'yearly')?.webBillingProduct;
  if (!monthly?.price || !yearly?.price) return null;
  return {
    monthly: micros(monthly.price),
    yearly: micros(yearly.price),
    intro: introFor(monthly.introPricePhase),
  };
}
