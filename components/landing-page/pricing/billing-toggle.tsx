'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/core/ui/cn';
import type { BillingPeriod } from '@/lib/domain/billing/pricing/web-prices';

/** The two ways to pay for Premium. Yearly is the default, so it comes first. */
const BILLING_PERIODS: readonly BillingPeriod[] = ['yearly', 'monthly'];

/**
 * The period switch, sat in the Premium card's top-right corner beside the
 * plan name — where the eye already is when it lands on the card.
 *
 * The Flutter paywall's segmented pill: a `--kallo-segment` track with a white
 * thumb under the selected side, full-ink semibold text on it, muted ink on
 * the other. `role="group"` and not a radiogroup — these are two buttons that
 * swap what the card shows, not a field being filled in.
 */
export function BillingToggle({
  period,
  onPeriodChange,
}: {
  period: BillingPeriod;
  onPeriodChange: (next: BillingPeriod) => void;
}) {
  const t = useTranslations('landing.pricing');

  return (
    <div
      className="inline-flex shrink-0 rounded-full bg-kallo-segment p-0.5"
      role="group"
    >
      {BILLING_PERIODS.map((option) => {
        const selected = option === period;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            data-testid={`pricing-period-${option}`}
            onClick={() => onPeriodChange(option)}
            className={cn(
              'cursor-pointer rounded-full px-3 py-1 font-sans-display text-xs transition-colors',
              selected
                ? 'bg-white font-semibold text-kallo-text shadow-sm'
                : 'text-kallo-text-muted hover:text-kallo-text'
            )}
          >
            {t(`period.${option}`)}
          </button>
        );
      })}
    </div>
  );
}
