'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { PlanCard } from './plan-card';
import type { BillingPeriod } from './plans';
import { PLAN_IDS } from './plans';

/**
 * Pricing.
 *
 * Three plans, and one decision inside the middle one — monthly or yearly.
 * Lifetime is a separate column rather than a third segment on that toggle,
 * because it isn't a billing term, it's a different thing to buy.
 *
 * No "save N%" badge: the annual discount is 32% in đồng and 58% in dollars,
 * so a single number would be a lie in one of the two locales. The per-month
 * equivalent under the yearly price says the same thing and stays true in both.
 */
export function PricingSection() {
  const t = useTranslations('landing.pricing');
  const { openDialog } = useAuthDialog();
  const reduced = useReducedMotion() ?? false;
  const [period, setPeriod] = useState<BillingPeriod>('yearly');

  const reveal = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-80px' },
        transition: { duration: 0.7, ease: [0.32, 0.72, 0, 1] as const },
      };

  return (
    // Cream, not white: the plan cards are white, and white cards on a white
    // ground only read by their border. On cream they sit the way every other
    // card in the app sits.
    <section
      id="pricing"
      className="relative scroll-mt-20 border-nham-border/40 border-t bg-nham-surface py-24 md:py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <motion.div {...reveal} className="max-w-2xl">
          <p className="eyebrow">{t('eyebrow')}</p>
          <h2 className="mt-4 font-normal font-serif text-4xl text-nham-text leading-[1.1] tracking-[-0.02em] md:text-5xl">
            {t('title')}{' '}
            <span className="italic-accent">{t('titleAccent')}</span>
          </h2>
          <p className="mt-6 font-sans-display text-lg text-nham-text-soft leading-relaxed">
            {t('subtitle')}
          </p>
        </motion.div>

        <motion.div
          {...reveal}
          className="mt-12 grid items-start gap-5 md:mt-16 md:grid-cols-3"
        >
          {PLAN_IDS.map((plan) => (
            <PlanCard
              key={plan}
              plan={plan}
              period={period}
              onPeriodChange={plan === 'premium' ? setPeriod : undefined}
              onSelect={() => openDialog('sign-up')}
            />
          ))}
        </motion.div>

        {/* Everything that stays free for everyone. It's a long list and none
            of it is gated, so it sits here as one line rather than as ten more
            identical tick rows in all three columns. */}
        <motion.div
          {...reveal}
          className="mt-12 border-nham-border/50 border-t pt-8"
        >
          <h3 className="font-medium font-sans-display text-nham-text text-sm">
            {t('everyoneTitle')}
          </h3>
          <p className="mt-2 max-w-3xl font-sans-display text-nham-text-soft text-sm leading-relaxed">
            {t('everyone')}
          </p>
          <p className="mt-6 font-sans-display text-nham-text-muted text-xs leading-relaxed">
            {t('betaNote')}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
