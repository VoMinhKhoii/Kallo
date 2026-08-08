'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AUTH_CTAS_LIVE } from '../cta-hold';
import { PLAN_FEATURES, type PlanId } from './plans';
import {
  type BillingPeriod,
  BillingToggle,
  PremiumPrice,
} from './premium-price';

/**
 * One plan: name, who it's for, what it costs, how to start, then what it adds.
 *
 * Free spells out what you get. Premium and Lifetime open with "everything in
 * <the tier below>, plus" and list only the difference, so no line is printed
 * three times.
 *
 * The card reads its own copy. Nothing above it has to resolve a price any
 * more now that the period toggle is gone — the fine print under the number
 * carries the terms instead.
 *
 * Four blocks — heading, price, button, features — laid on a subgrid inherited
 * from the section. Each row takes the tallest card's height, so the three
 * prices sit on one line, the three buttons sit on one line and the three
 * lists start together, whatever the copy does at any width or in any locale.
 * That matters most here: Premium's fine print runs to two lines and the other
 * two run to one.
 */
export function PlanCard({
  plan,
  onSelect,
}: {
  plan: PlanId;
  onSelect: () => void;
}) {
  const t = useTranslations('landing.pricing');
  const featured = plan === 'premium';
  // Premium's only state, and it lives here rather than in the section: no
  // other card has a period, so lifting it would put a Premium concern in a
  // component that renders all of them.
  const [period, setPeriod] = useState<BillingPeriod>('yearly');

  return (
    <div
      className={`flex flex-col rounded-3xl border bg-white p-7 text-left sm:p-8 md:row-span-4 md:grid md:grid-rows-subgrid ${
        featured
          ? 'border-nham-accent/45 shadow-md ring-1 ring-nham-accent/15'
          : 'border-nham-border/60 shadow-sm'
      }`}
    >
      {/* The switch shares a row with the NAME only, and the tagline sits
          below at full card width. Wrapping all three in one flex row cost the
          tagline about a third of its width and broke "For logging in your own
          words" over two lines, for no reason other than where the toggle
          happened to be. */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-semibold font-serif text-3xl text-nham-text">
            {t(`plans.${plan}.name`)}
          </h3>
          {featured && (
            <BillingToggle period={period} onPeriodChange={setPeriod} />
          )}
        </div>
        <p className="mt-1 font-sans-display text-nham-text-soft">
          {t(`plans.${plan}.tagline`)}
        </p>
      </div>

      {/* Premium is the only plan with two ways to pay, so it is the only one
          that carries a switch. The others keep the single flat price they
          have always had — a toggle on a plan with one price would be a control
          that does nothing. Both shapes occupy the same subgrid row, so the
          prices still sit on one line across the cards. */}
      {featured ? (
        <PremiumPrice period={period} />
      ) : (
        <div className="mt-8">
          <p className="font-bold font-sans-display text-4xl text-nham-text tabular-nums">
            {t(`plans.${plan}.price`)}
          </p>
          <p className="mt-4 font-sans-display text-nham-text-soft text-sm leading-relaxed">
            {t(`plans.${plan}.fineprint`)}
          </p>
        </div>
      )}

      {/* h-11 to match the waitlist button in the hero — the default h-9 is a
          36px bar spanning a card with 32px padding, which reads squat. */}
      <Button
        variant="landing-ink"
        className="mt-8 h-11 w-full font-sans-display"
        disabled={!AUTH_CTAS_LIVE}
        onClick={onSelect}
      >
        {t(`plans.${plan}.cta`)}
      </Button>

      <div className="mt-8 border-nham-border/50 border-t pt-6">
        <p className="mb-4 font-sans-display font-semibold text-nham-text text-sm">
          {t(`plans.${plan}.inherits`)}
        </p>
        <ul className="space-y-3">
          {PLAN_FEATURES[plan].map((id) => (
            <li key={id} className="flex items-start gap-2.5">
              <Check
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-nham-text-soft"
              />
              <span className="font-sans-display text-nham-text-soft text-sm leading-snug">
                {t(`features.${id}`)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
