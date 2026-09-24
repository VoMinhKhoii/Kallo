'use client';

import { createContext, use } from 'react';
import type {
  FreeCtaState,
  PremiumCtaState,
} from '@/lib/domain/billing/pricing/checkout-state';
import type {
  BillingPeriod,
  WebPrices,
} from '@/lib/domain/billing/pricing/web-prices';

/** Shown in place of the cards once a checkout has completed. */
interface CheckoutStatus {
  activationPending: boolean;
  checkingActivation: boolean;
  onAction: () => void;
}

/**
 * What the pricing cards' buttons do for the current visitor.
 *
 * The landing page mounts no provider, so it reads `SIGNED_OUT` — every
 * button opens sign-up. /pricing mounts `PricingCheckoutProvider`, which
 * turns the cards into the purchase surface once the visitor is known.
 */
export interface PricingCheckout {
  freeCta: FreeCtaState;
  premiumCta: (period: BillingPeriod) => PremiumCtaState;
  /** A checkout is open or its activation is being polled. */
  purchasing: boolean;
  buy: (period: BillingPeriod) => void;
  status: CheckoutStatus | null;
  live: LivePrices;
}

/**
 * Where the cards read live prices from. Exactly one Paddle.js may run on the
 * page: RevenueCat boots its own for a signed-in visitor's checkout, so the
 * Paddle price preview (`paddle`) is only for signed-out visitors; a
 * signed-in one reads the offering their checkout uses (`offering`), and
 * nothing live is read until the visitor is known (`none`).
 */
export type LivePrices =
  | { source: 'none' }
  | { source: 'paddle' }
  | { source: 'offering'; prices: WebPrices | null };

const SIGNED_OUT: PricingCheckout = {
  freeCta: 'sign-up',
  premiumCta: () => 'sign-up',
  purchasing: false,
  buy: () => {},
  status: null,
  live: { source: 'paddle' },
};

export const PricingCheckoutContext =
  createContext<PricingCheckout>(SIGNED_OUT);

export function usePricingCheckout(): PricingCheckout {
  return use(PricingCheckoutContext);
}
