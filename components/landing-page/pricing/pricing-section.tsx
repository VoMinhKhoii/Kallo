'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { PlanCard } from './plan-card';
import { PLAN_IDS } from './plans';

/**
 * Pricing.
 *
 * One word and three cards. There is no monthly/yearly switch: Premium quotes
 * the annual rate per month and its fine print says what is billed up front
 * and what the monthly alternative costs. That puts both numbers on screen at
 * once, where a toggle showed one and hid the other behind an interaction —
 * and it takes the section back to being static, with no state at all.
 *
 * For the same reason there is no "save N%" badge. The annual discount is 32%
 * in đồng and 58% in dollars, so a single number would be a lie in one of the
 * two locales; the fine print carries the real terms in each.
 */
export function PricingSection() {
  const t = useTranslations('landing.pricing');
  const { openDialog } = useAuthDialog();
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
    // Beige ground, the same `--nham-hover` the comparison panels above use.
    // The white plan cards then sit on it exactly as the white meal cards sit
    // on their panels, so the page has one card-on-beige relationship rather
    // than two grounds doing the same job. It is opaque, so the drifting wash
    // stops at this band — which is wanted: the page ends on something solid
    // instead of fading out under the footer.
    <section
      id="pricing"
      className="relative scroll-mt-20 border-nham-border/40 border-t bg-nham-hover pt-12 pb-10 md:pt-16 md:pb-12"
    >
      <div className="mx-auto max-w-[88rem] px-6 sm:px-12 lg:px-20">
        <motion.h2
          {...reveal}
          className="text-center font-normal font-serif text-5xl text-nham-text tracking-[-0.02em] md:text-6xl"
        >
          {t('title')}
        </motion.h2>

        {/* Four named rows the cards hang their blocks on — heading, price,
            button, features — so each row is as tall as the tallest card and
            the three columns line up across. Below md the cards stack, the
            subgrid is off, and the row gap goes back to being the gap between
            cards. */}
        <motion.div
          {...reveal}
          className="mt-10 grid gap-x-5 gap-y-5 md:mt-12 md:grid-cols-3 md:grid-rows-[auto_auto_auto_1fr] md:gap-y-0"
        >
          {PLAN_IDS.map((plan) => (
            <PlanCard
              key={plan}
              plan={plan}
              onSelect={() => openDialog('sign-up')}
            />
          ))}
        </motion.div>

        <motion.p
          {...reveal}
          className="mt-8 text-center font-sans-display text-nham-text-soft text-xs leading-relaxed"
        >
          {t('betaNote')}
        </motion.p>
      </div>
    </section>
  );
}
