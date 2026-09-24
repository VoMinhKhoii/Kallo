'use client';

import { useLocale, useTranslations } from 'next-intl';
import { premiumDisplay } from '@/lib/domain/billing/pricing/premium-display';
import type { BillingPeriod } from '@/lib/domain/billing/pricing/web-prices';
import { AUTH_CTAS_LIVE } from '../cta-hold';
import { usePricingCheckout } from './checkout/checkout-context';
import { useLivePrices } from './checkout/use-live-prices';
import { PremiumCta } from './premium-cta';
import { PremiumPrice } from './premium-price';

/**
 * Premium's price row and button row — two subgrid children, so it returns a
 * fragment and the card lines them up with Free's.
 *
 * The prices are the visitor's own from Paddle (by country) once they load,
 * the locale's message fallbacks until then. The button follows the checkout
 * state: sign-up when signed out, checkout for a signed-in Free user, "Current
 * plan" for a subscriber, and disabled with a line saying why when the store
 * is closed or the offering could not be read.
 */
export function PremiumOffer({
  period,
  onSignUp,
}: {
  period: BillingPeriod;
  onSignUp: () => void;
}) {
  const t = useTranslations('landing.pricing');
  const tBilling = useTranslations('billing');
  const locale = useLocale();
  const checkout = usePricingCheckout();
  const live = useLivePrices();

  const base = 'plans.premium';
  const display = premiumDisplay(period, live, locale, {
    priceMonthly: t(`${base}.priceMonthly`),
    priceYearly: t(`${base}.priceYearly`),
    billedMonthly: t(`${base}.billedMonthly`),
    billedYearly: t(`${base}.billedYearly`),
    introPrice: t(`${base}.introPrice`),
    introDays: Number(t.raw(`${base}.introDays`)),
    amountMonthly: Number(t.raw(`${base}.amountMonthly`)),
    amountYearly: Number(t.raw(`${base}.amountYearly`)),
  });

  const state = checkout.premiumCta(period);
  const label =
    state === 'current'
      ? t('currentPlan')
      : display.intro
        ? t(`${base}.cta`, { intro: display.intro.price })
        : t(`${base}.ctaNoIntro`);

  const note =
    state === 'closed'
      ? tBilling('premium.purchasesUnavailable')
      : state === 'failed'
        ? tBilling('paywall.unavailable')
        : null;

  return (
    <>
      <PremiumPrice period={period} display={display} />
      <div className="mt-8">
        <PremiumCta
          label={label}
          savePercent={state === 'current' ? null : display.savePercent}
          disabled={state === 'sign-up' ? !AUTH_CTAS_LIVE : state !== 'buy'}
          busy={state === 'loading' || (state === 'buy' && checkout.purchasing)}
          onClick={() => {
            if (state === 'sign-up') onSignUp();
            else if (state === 'buy') checkout.buy(period);
          }}
        />
        {note && (
          <p className="mt-3 font-sans-display text-kallo-text-muted text-xs leading-relaxed">
            {note}
          </p>
        )}
      </div>
    </>
  );
}
