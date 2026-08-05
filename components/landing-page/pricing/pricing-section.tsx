'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { FeatureRow } from './feature-row';
import { PlanCard } from './plan-card';
import type { BillingPeriod } from './plans';
import { FEATURE_GROUPS, PLAN_IDS, PRICING_FEATURES } from './plans';

/**
 * Pricing.
 *
 * Three prices, and one decision inside the middle one — monthly or yearly.
 * Lifetime is a separate column rather than a third segment on that toggle,
 * because it isn't a billing term, it's a different thing to buy.
 *
 * The feature list appears once, under all three, and describes Free only.
 * Premium and Lifetime include everything, so a three-column grid would have
 * been twenty identical ticks; one sentence under the list carries what they
 * add instead.
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
    // ground only read by their border.
    <section
      id="pricing"
      className="relative scroll-mt-20 border-nham-border/40 border-t bg-nham-surface py-24 md:py-32"
    >
      <div className="mx-auto max-w-5xl px-6">
        <motion.h2
          {...reveal}
          className="text-center font-normal font-serif text-4xl text-nham-text leading-[1.1] tracking-[-0.02em] md:text-5xl"
        >
          {t('title')} <span className="italic-accent">{t('titleAccent')}</span>
        </motion.h2>

        <motion.div
          {...reveal}
          className="mt-12 grid items-start gap-4 md:mt-16 md:grid-cols-3"
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

        <motion.div
          {...reveal}
          className="mt-14 border-nham-border/50 border-t pt-10"
        >
          <h3 className="font-medium font-sans-display text-nham-text text-sm">
            {t('freeTitle')}
          </h3>

          <div className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {FEATURE_GROUPS.map((group) => (
              <div key={group}>
                <h4 className="font-medium font-sans-display text-[11px] text-nham-text-muted">
                  {t(`groups.${group}`)}
                </h4>
                <ul className="mt-3 space-y-2.5">
                  {PRICING_FEATURES.filter((f) => f.group === group).map(
                    (feature) => (
                      <FeatureRow key={feature.id} feature={feature} />
                    )
                  )}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 space-y-2 border-nham-border/50 border-t pt-8">
            <p className="font-sans-display text-nham-text-soft text-sm leading-relaxed">
              {t('paidNote')}
            </p>
            <p className="font-sans-display text-nham-text-muted text-sm leading-relaxed">
              {t('everyone')}
            </p>
            <p className="pt-2 font-sans-display text-nham-text-muted text-xs">
              {t('betaNote')}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
