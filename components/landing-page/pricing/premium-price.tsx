'use client';

import { useTranslations } from 'next-intl';
import type { PremiumDisplay } from '@/lib/domain/billing/pricing/premium-display';
import type { BillingPeriod } from '@/lib/domain/billing/pricing/web-prices';

/** Message-key suffix for the selected period. */
function suffix(period: BillingPeriod) {
  return period === 'yearly' ? 'Yearly' : 'Monthly';
}

/**
 * Premium's price, and the fine print that says what is actually charged.
 *
 * **Both periods quote a monthly rate**, and that is the whole reason the
 * switch is worth having: `$2.50/mo` against `$7.99/mo` is a comparison
 * already done, where `$29.99` against `$7.99` asks the reader to divide. What
 * each renewal bills, the paid first week, and that tax is added at checkout
 * move into the fine print, where they still have to be stated.
 *
 * The numbers arrive resolved (`premiumDisplay`): live Paddle prices for the
 * visitor's country when they have loaded, the locale's message fallbacks
 * until then. The yearly saving is not here — it hangs off the buy button.
 */
export function PremiumPrice({
  period,
  display,
}: {
  period: BillingPeriod;
  display: PremiumDisplay;
}) {
  const t = useTranslations('landing.pricing');
  const base = 'plans.premium';

  const fineprint = display.intro
    ? t(`${base}.fineprint${suffix(period)}`, {
        intro: display.intro.price,
        days: display.intro.days,
        price: display.billed,
      })
    : t(`${base}.fineprint${suffix(period)}NoIntro`, { price: display.billed });

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-2">
        <p
          className="font-bold font-sans-display text-4xl text-kallo-text tabular-nums"
          data-testid="pricing-premium-price"
        >
          {display.price}
        </p>
        <span className="font-sans-display text-kallo-text-soft text-sm">
          {t('perMonth')}
        </span>
      </div>

      <p
        className="mt-4 font-sans-display text-kallo-text-soft text-sm leading-relaxed"
        data-testid="pricing-premium-fineprint"
      >
        {fineprint}
      </p>
    </div>
  );
}
