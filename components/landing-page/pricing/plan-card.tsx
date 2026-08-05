'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { BillingPeriod, PlanId } from './plans';

/** Two segments, sitting in the Premium card where the term is decided. */
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
      className="inline-flex rounded-full border border-nham-border bg-nham-surface p-0.5"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={period === option}
          onClick={() => onChange(option)}
          className={`rounded-full px-3 py-1 font-sans-display text-xs transition-colors ${
            period === option
              ? 'bg-white font-semibold text-nham-text shadow-xs'
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
 * One plan: what it's called, what it costs, how to start. Nothing else — the
 * feature list is shared below all three rather than repeated inside each.
 *
 * Only Premium carries the brown button. One primary CTA per surface is a
 * brand rule, and it also states an opinion about which plan is the answer.
 */
export function PlanCard({
  plan,
  period,
  onPeriodChange,
  onSelect,
}: {
  plan: PlanId;
  period: BillingPeriod;
  /** Supplied only for Premium; the term toggle lives on that card. */
  onPeriodChange?: (next: BillingPeriod) => void;
  onSelect: () => void;
}) {
  const t = useTranslations('landing.pricing');
  const featured = plan === 'premium';
  const yearly = period === 'yearly';

  const price = featured
    ? t(yearly ? 'plans.premium.priceYearly' : 'plans.premium.priceMonthly')
    : t(`plans.${plan}.price`);
  const cadence = featured
    ? t(yearly ? 'plans.premium.cadenceYear' : 'plans.premium.cadenceMonth')
    : t(`plans.${plan}.cadence`);

  return (
    <div
      className={`flex flex-col rounded-2xl border bg-white p-6 text-left ${
        featured
          ? 'border-nham-accent/45 shadow-md ring-1 ring-nham-accent/15'
          : 'border-nham-border/60 shadow-sm'
      }`}
    >
      {/* Reserved height so the three prices sit on one line even though only
          Premium carries a toggle. Only once the cards are side by side —
          stacked, there is nothing to line up with and it is just a hole. */}
      <div className="flex flex-col md:min-h-[9rem]">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium font-sans-display text-nham-text">
            {t(`plans.${plan}.name`)}
          </h3>
          {featured && (
            <span className="rounded-full bg-nham-hover px-2 py-0.5 font-medium font-sans-display text-[10px] text-nham-text">
              {t('plans.premium.trialBadge')}
            </span>
          )}
        </div>

        {onPeriodChange && (
          <div className="mt-3">
            <PeriodToggle period={period} onChange={onPeriodChange} />
          </div>
        )}

        <div className="mt-auto pt-4">
          <div className="flex items-baseline gap-1.5">
            <span className="font-normal font-serif text-4xl text-nham-text tabular-nums">
              {price}
            </span>
            <span className="font-sans-display text-nham-text-muted text-sm">
              {cadence}
            </span>
          </div>
          <p className="mt-1 min-h-[1.25rem] font-sans-display text-nham-text-muted text-xs">
            {featured && yearly ? t('plans.premium.perMonth') : ''}
          </p>
        </div>
      </div>

      <Button
        variant={featured ? 'landing-primary' : 'landing-secondary'}
        className="mt-5 w-full font-sans-display"
        onClick={onSelect}
      >
        {t(`plans.${plan}.cta`)}
      </Button>
    </div>
  );
}
