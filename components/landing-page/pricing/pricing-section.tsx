'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { PaywallStatus } from '@/components/billing/activation/paywall-status';
import { usePricingCheckout } from './checkout/checkout-context';
import { PlanCard } from './plan-card';
import { PLAN_IDS } from './plans';

/**
 * Pricing.
 *
 * One word and two cards — Lifetime is held back, see `PLAN_IDS`.
 *
 * The monthly/yearly switch lives on the Premium card, which owns the period
 * state — the section itself holds none. The same section is the landing
 * band and the whole of /pricing; on /pricing a `PricingCheckoutProvider`
 * turns the buttons into the purchase flow for a signed-in visitor, and once
 * a checkout completes the cards give way to its status (activated, or still
 * waiting on the store).
 */
export function PricingSection() {
  const t = useTranslations('landing.pricing');
  const { openDialog } = useAuthDialog();
  const { status } = usePricingCheckout();
  const reduced = useReducedMotion() ?? false;

  const reveal = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-80px' },
        transition: { duration: 0.7, ease: [0.32, 0.72, 0, 1] as const },
      };

  return (
    // Beige ground, the same `--kallo-hover` the comparison panels above use.
    // The white plan cards then sit on it exactly as the white meal cards sit
    // on their panels, so the page has one card-on-beige relationship rather
    // than two grounds doing the same job. It is opaque, so the drifting wash
    // stops at this band — which is wanted: the page ends on something solid
    // instead of fading out under the footer.
    <section
      aria-labelledby="landing-pricing"
      id="pricing"
      className="relative scroll-mt-20 border-kallo-border/40 border-t bg-kallo-hover pt-8 pb-8 md:pt-10 md:pb-10"
    >
      <div className="mx-auto max-w-[92rem] px-6 sm:px-12 lg:px-20">
        <motion.h2
          {...reveal}
          className="text-center font-normal font-serif text-4xl text-kallo-text tracking-[-0.02em] sm:text-5xl md:text-6xl"
          id="landing-pricing"
        >
          {t('title')}
        </motion.h2>

        {/* Four named rows the cards hang their blocks on — heading, price,
            button, features — so each row is as tall as the tallest card and
            the columns line up across. Below md the cards stack, the subgrid is
            off, and the row gap goes back to being the gap between cards.

            Capped and centred rather than filling the section's 92rem measure.
            With Lifetime held back there are two cards, and two cards spread
            across the full width would each be half a screen wide — the cap
            holds them at the ~26rem they were at three across, so removing a
            plan changes the count and nothing else. */}
        {status ? (
          <div className="mx-auto mt-10 max-w-md rounded-3xl border border-kallo-border/60 bg-white shadow-sm md:mt-12">
            <PaywallStatus
              activationPending={status.activationPending}
              checkingActivation={status.checkingActivation}
              onAction={status.onAction}
            />
          </div>
        ) : (
          <motion.div
            {...reveal}
            className="mt-10 grid gap-x-5 gap-y-5 md:mt-12 md:max-w-[54rem] md:grid-cols-2 md:grid-rows-[auto_auto_auto_1fr] md:gap-y-0 lg:mx-auto"
          >
            {PLAN_IDS.map((plan) => (
              <PlanCard
                key={plan}
                plan={plan}
                onSignUp={() => openDialog('sign-up')}
              />
            ))}
          </motion.div>
        )}

        <motion.p
          {...reveal}
          className="mt-8 text-center font-sans-display text-kallo-text-soft text-xs leading-relaxed"
        >
          {t('betaNote')}
        </motion.p>
      </div>
    </section>
  );
}
