'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { PlanCard } from './plan-card';
import { type BillingPeriod, PLAN_IDS, type PlanId } from './plans';

/** Monthly or yearly, centred under the title and above all three cards. */
function PeriodToggle({
  period,
  onChange,
}: {
  period: BillingPeriod;
  onChange: (next: BillingPeriod) => void;
}) {
  const t = useTranslations('landing.pricing.period');
  const options: BillingPeriod[] = ['monthly', 'yearly'];

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="inline-flex rounded-full border border-nham-border bg-white p-1"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={period === option}
          onClick={() => onChange(option)}
          className={`rounded-full px-4 py-1.5 font-sans-display text-sm transition-colors ${
            period === option
              ? 'bg-nham-hover font-semibold text-nham-text'
              : 'text-nham-text-muted hover:text-nham-text'
          }`}
        >
          {t(option)}
        </button>
      ))}
    </div>
  );
}

/**
 * Pricing.
 *
 * One word, the term switch, three cards. The switch sits above the row rather
 * than inside Premium: it is the only card whose price it changes, but putting
 * it in there made that card taller than the other two and forced a reserved
 * gap in both of them to keep the prices on one line.
 *
 * No "save N%" badge. The annual discount is 32% in đồng and 58% in dollars,
 * so one number would be a lie in one of the two locales — the fine print
 * under each price carries the real terms instead.
 */
export function PricingSection() {
  const t = useTranslations('landing.pricing');
  const { openDialog } = useAuthDialog();
  const reduced = useReducedMotion() ?? false;
  const [period, setPeriod] = useState<BillingPeriod>('yearly');
  const yearly = period === 'yearly';

  const reveal = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-80px' },
        transition: { duration: 0.7, ease: [0.32, 0.72, 0, 1] as const },
      };

  // Premium is the only plan whose price moves with the term.
  const priceFor = (plan: PlanId) =>
    plan === 'premium'
      ? t(yearly ? 'plans.premium.priceYearly' : 'plans.premium.priceMonthly')
      : t(`plans.${plan}.price`);
  const fineprintFor = (plan: PlanId) =>
    plan === 'premium'
      ? t(
          yearly
            ? 'plans.premium.fineprintYearly'
            : 'plans.premium.fineprintMonthly'
        )
      : t(`plans.${plan}.fineprint`);

  return (
    // Cream, not white: the plan cards are white, and white cards on a white
    // ground only read by their border.
    <section
      id="pricing"
      className="relative scroll-mt-20 border-nham-border/40 border-t bg-nham-surface py-24 md:py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <motion.div {...reveal} className="flex flex-col items-center">
          <h2 className="font-normal font-serif text-5xl text-nham-text tracking-[-0.02em] md:text-6xl">
            {t('title')}
          </h2>
          <div className="mt-10">
            <PeriodToggle period={period} onChange={setPeriod} />
          </div>
        </motion.div>

        {/* Four named rows the cards hang their blocks on — heading, price,
            button, features — so each row is as tall as the tallest card and
            the three columns line up across. Below md the cards stack, the
            subgrid is off, and the row gap goes back to being the gap between
            cards. */}
        <motion.div
          {...reveal}
          className="mt-12 grid gap-x-5 gap-y-5 md:mt-14 md:grid-cols-3 md:grid-rows-[auto_auto_auto_1fr] md:gap-y-0"
        >
          {PLAN_IDS.map((plan) => (
            <PlanCard
              key={plan}
              plan={plan}
              price={priceFor(plan)}
              fineprint={fineprintFor(plan)}
              onSelect={() => openDialog('sign-up')}
            />
          ))}
        </motion.div>

        <motion.p
          {...reveal}
          className="mt-10 text-center font-sans-display text-nham-text-muted text-xs leading-relaxed"
        >
          {t('betaNote')}
        </motion.p>
      </div>
    </section>
  );
}
