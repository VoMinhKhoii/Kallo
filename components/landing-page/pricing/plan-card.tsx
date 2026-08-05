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
 * Only Premium carries the brown button. One primary CTA per surface is a
 * brand rule, and it also states an opinion about which plan is the answer —
 * which is why the other two are outlined rather than filled.
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
  const inherits = plan !== 'free';

  return (
    <div
      className={`flex flex-col rounded-3xl border bg-white p-7 text-left sm:p-8 ${
        featured
          ? 'border-nham-accent/45 shadow-md ring-1 ring-nham-accent/15'
          : 'border-nham-border/60 shadow-sm'
      }`}
    >
      <h3 className="font-normal font-serif text-3xl text-nham-text">
        {t(`plans.${plan}.name`)}
      </h3>
      <p className="mt-1 font-sans-display text-nham-text-muted text-sm">
        {t(`plans.${plan}.tagline`)}
      </p>

      {/* Reserved height so the three prices land on one line across the row;
          the fine print runs to two lines on Premium and one elsewhere. */}
      <div className="mt-7 md:min-h-[5.5rem]">
        <p className="font-bold font-sans-display text-3xl text-nham-text tabular-nums">
          {price}
        </p>
        <p className="mt-1.5 font-sans-display text-nham-text-muted text-xs leading-relaxed">
          {fineprint}
        </p>
      </div>

      <Button
        variant={featured ? 'landing-primary' : 'landing-secondary'}
        className="mt-6 w-full font-sans-display"
        onClick={onSelect}
      >
        {t(`plans.${plan}.cta`)}
      </Button>

      <div className="mt-7 border-nham-border/50 border-t pt-6">
        {inherits && (
          <p className="mb-4 font-sans-display font-semibold text-nham-text text-sm">
            {t(`plans.${plan}.inherits`)}
          </p>
        )}
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
