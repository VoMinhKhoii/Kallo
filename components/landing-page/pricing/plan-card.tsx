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
 * Four blocks — heading, price, button, features — laid on a subgrid inherited
 * from the section. Each row takes the tallest card's height, so the three
 * prices sit on one line, the three buttons sit on one line and the three
 * lists start together, whatever the copy does at any width or in any locale.
 * That is the whole reason for the grid: the alternative is reserving heights
 * with pixel values guessed per translation.
 */
export function PlanCard({
  plan,
  price,
  fineprint,
  onSelect,
}: {
  plan: PlanId;
  /** Already resolved by the section, since Premium's depends on the term. */
  price: string;
  fineprint: string;
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
        <p className="mt-1 font-sans-display text-nham-text-muted text-sm">
          {t(`plans.${plan}.tagline`)}
        </p>
      </div>

      <div className="mt-7">
        <p className="font-bold font-sans-display text-3xl text-nham-text tabular-nums">
          {price}
        </p>
        <p className="mt-1.5 font-sans-display text-nham-text-muted text-xs leading-relaxed">
          {fineprint}
        </p>
      </div>

      {/* Black on every card. The lift and drop shadow the `hero-dark` variant
          carries are for a button standing on the page, not one sitting inside
          a card, so both come off here. */}
      <Button
        variant="hero-dark"
        className="mt-6 w-full self-start font-sans-display shadow-none hover:translate-y-0"
        onClick={onSelect}
      >
        {t(`plans.${plan}.cta`)}
      </Button>

      <div className="mt-7 border-nham-border/50 border-t pt-6">
        <p className="mb-4 font-sans-display font-semibold text-nham-text text-sm">
          {t(`plans.${plan}.inherits`)}
        </p>
        <ul className="space-y-3">
          {PLAN_FEATURES[plan].map((id) => (
            <li key={id} className="flex items-start gap-2.5">
              <Check
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-nham-text-muted"
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
