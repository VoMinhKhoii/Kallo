'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/core/ui/cn';
import type { BillingPeriod } from '@/lib/domain/billing/pricing/web-prices';
import { AUTH_CTAS_LIVE } from '../cta-hold';
import { BillingToggle } from './billing-toggle';
import { usePricingCheckout } from './checkout/checkout-context';
import { PLAN_FEATURES, type PlanId } from './plans';
import { PremiumOffer } from './premium-offer';

/**
 * One plan: name, who it's for, what it costs, how to start, then what it adds.
 *
 * Free spells out what you get. Premium and Lifetime open with "everything in
 * <the tier below>, plus" and list only the difference, so no line is printed
 * three times.
 *
 * Four blocks — heading, price, button, features — laid on a subgrid inherited
 * from the section. Each row takes the tallest card's height, so the prices sit
 * on one line, the buttons sit on one line and the lists start together,
 * whatever the copy does at any width or in any locale. Premium's price and
 * button are `PremiumOffer`, the one plan with live prices and a checkout.
 *
 * Premium wears the gold: a 1px gold edge, a soft gold glow and a faint gold
 * wash across its top. No ribbon — the gold button already says which card is
 * the offer.
 */
export function PlanCard({
  plan,
  onSignUp,
}: {
  plan: PlanId;
  onSignUp: () => void;
}) {
  const t = useTranslations('landing.pricing');
  const featured = plan === 'premium';
  // Premium's only state, and it lives here rather than in the section: no
  // other card has a period, so lifting it would put a Premium concern in a
  // component that renders all of them.
  const [period, setPeriod] = useState<BillingPeriod>('yearly');

  return (
    <div
      className={cn(
        'flex flex-col rounded-3xl border p-7 text-left sm:p-8 md:row-span-4 md:grid md:grid-rows-subgrid',
        featured
          ? 'border-kallo-gold-edge bg-linear-to-b from-kallo-gold-wash to-20% to-white shadow-kallo-gold-deep/20 shadow-xl'
          : 'border-kallo-border/60 bg-white shadow-sm'
      )}
    >
      {/* The switch shares a row with the NAME only, and the tagline sits
          below at full card width, so it never wraps early for the toggle. */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-semibold font-serif text-3xl text-kallo-text">
            {t(`plans.${plan}.name`)}
          </h3>
          {featured && (
            <BillingToggle period={period} onPeriodChange={setPeriod} />
          )}
        </div>
        <p className="mt-1 font-sans-display text-kallo-text-soft">
          {t(`plans.${plan}.tagline`)}
        </p>
      </div>

      {featured ? (
        <PremiumOffer period={period} onSignUp={onSignUp} />
      ) : (
        <FlatOffer plan={plan} onSignUp={onSignUp} />
      )}

      <div
        className={cn(
          'mt-8 border-t pt-6',
          featured ? 'border-kallo-gold-edge/25' : 'border-kallo-border/50'
        )}
      >
        <p className="mb-4 font-sans-display font-semibold text-kallo-text text-sm">
          {t(`plans.${plan}.inherits`)}
        </p>
        <ul className="space-y-3">
          {PLAN_FEATURES[plan].map((id) => (
            <li key={id} className="flex items-start gap-2.5">
              <Check
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-kallo-text-soft"
              />
              <span className="font-sans-display text-kallo-text-soft text-sm leading-snug">
                {t(`features.${id}`)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * A plan with one flat price and no checkout of its own (Free, and Lifetime
 * while it is held back): its price row and its ink pill, which opens sign-up
 * for a visitor and reads "Current plan" for a signed-in Free user.
 */
function FlatOffer({ plan, onSignUp }: { plan: PlanId; onSignUp: () => void }) {
  const t = useTranslations('landing.pricing');
  const { freeCta } = usePricingCheckout();
  const state =
    plan === 'free' || freeCta === 'sign-up' ? freeCta : ('none' as const);

  return (
    <>
      <div className="mt-8">
        <p className="font-bold font-sans-display text-4xl text-kallo-text tabular-nums">
          {t(`plans.${plan}.price`)}
        </p>
        <p className="mt-4 font-sans-display text-kallo-text-soft text-sm leading-relaxed">
          {t(`plans.${plan}.fineprint`)}
        </p>
      </div>

      <div className="mt-8">
        <Button
          variant="landing-ink"
          className="h-12 w-full rounded-full font-sans-display"
          data-testid={`pricing-${plan}-cta`}
          disabled={state === 'sign-up' ? !AUTH_CTAS_LIVE : true}
          onClick={onSignUp}
        >
          {state === 'current' ? t('currentPlan') : t(`plans.${plan}.cta`)}
        </Button>
      </div>
    </>
  );
}
