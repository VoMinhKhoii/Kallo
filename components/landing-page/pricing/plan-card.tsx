'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { PLAN_FEATURES, type PlanId } from './plans';

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

  return (
    <div
      className={`flex flex-col rounded-3xl border bg-white p-7 text-left sm:p-8 md:row-span-4 md:grid md:grid-rows-subgrid ${
        featured
          ? 'border-nham-accent/45 shadow-md ring-1 ring-nham-accent/15'
          : 'border-nham-border/60 shadow-sm'
      }`}
    >
      <div>
        <h3 className="font-semibold font-serif text-3xl text-nham-text">
          {t(`plans.${plan}.name`)}
        </h3>
        <p className="mt-1 font-sans-display text-nham-text-soft">
          {t(`plans.${plan}.tagline`)}
        </p>
      </div>

      <div className="mt-8">
        <p className="font-bold font-sans-display text-4xl text-nham-text tabular-nums">
          {t(`plans.${plan}.price`)}
        </p>
        <p className="mt-4 font-sans-display text-nham-text-soft text-sm leading-relaxed">
          {t(`plans.${plan}.fineprint`)}
        </p>
      </div>

      {/* h-11 to match the waitlist button in the hero — the default h-9 is a
          36px bar spanning a card with 32px padding, which reads squat. */}
      <Button
        variant="landing-ink"
        className="mt-8 h-11 w-full font-sans-display"
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
