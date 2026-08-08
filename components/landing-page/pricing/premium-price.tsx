'use client';

import { useTranslations } from 'next-intl';
import { HIGHLIGHT_BADGE } from '../highlight';

/** The two ways to pay for Premium. Yearly is the default, so it comes first. */
export const BILLING_PERIODS = ['yearly', 'monthly'] as const;

export type BillingPeriod = (typeof BILLING_PERIODS)[number];

/** Message-key suffix for the selected period. */
function suffix(period: BillingPeriod) {
  return period === 'yearly' ? 'Yearly' : 'Monthly';
}

/**
 * The period switch, sat in the card's top-right corner beside the plan name.
 *
 * Up here rather than above the price, because that is where the eye already
 * is when it lands on the card, and because sitting it over the number pushed
 * the price down out of line with the other card's.
 *
 * The app's selection language rather than a filled pill: the beige
 * `--nham-hover` wash with full-ink semibold text for the selected side, plain
 * muted ink for the other. `role="group"` and not a radiogroup — these are two
 * buttons that swap what the card shows, not a field being filled in.
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
      className="inline-flex shrink-0 rounded-full border border-nham-border/70 p-0.5"
      role="group"
    >
      {BILLING_PERIODS.map((option) => {
        const selected = option === period;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onPeriodChange(option)}
            className={`rounded-full px-3 py-1 font-sans-display text-xs transition-colors ${
              selected
                ? 'bg-nham-hover font-semibold text-nham-text'
                : 'text-nham-text-soft hover:text-nham-text'
            }`}
          >
            {t(`period.${option}`)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Premium's price, and the saving the yearly plan earns you.
 *
 * **Both periods quote a monthly rate**, and that is the whole reason the
 * switch is worth having. Showing `$24.99` against `$3.49` asks the reader to
 * divide before they can tell which is cheaper; `$2.08/mo` against `$3.49/mo`
 * is the same comparison already done. What the year actually costs, and when
 * it is taken, moves into the fine print where it still has to be stated.
 *
 * **The percentage is computed, never authored.** It has to be: the annual
 * discount is 40% in dollars and 32% in đồng, so a hardcoded badge would be
 * wrong in one locale, and a badge that drifts from the prices beside it is
 * worse than none. The messages carry `amountMonthly` and `amountYearly` as
 * bare numbers — the real billed amounts, not the per-month display strings —
 * so a price change moves the badge with it and nothing branches on locale.
 */
export function PremiumPrice({ period }: { period: BillingPeriod }) {
  const t = useTranslations('landing.pricing');
  const base = 'plans.premium';

  const monthly = Number(t.raw(`${base}.amountMonthly`));
  const yearly = Number(t.raw(`${base}.amountYearly`));

  // A badge is only shown when the arithmetic actually produced a saving.
  // `t.raw` hands back whatever the message file holds, so a missing or
  // mistyped amount arrives as NaN and a zero monthly rate divides to
  // Infinity — either way `Math.round` yields something, and "Save NaN%"
  // printed next to a real price is worse than no badge at all.
  const percent = Math.round((1 - yearly / (monthly * 12)) * 100);
  const showSaving =
    period === 'yearly' && Number.isFinite(percent) && percent > 0;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-2">
        <p className="font-bold font-sans-display text-4xl text-nham-text tabular-nums">
          {t(`${base}.price${suffix(period)}`)}
        </p>
        <span className="font-sans-display text-nham-text-soft text-sm">
          {t('perMonth')}
        </span>
        {showSaving && (
          <span className={`ml-1 ${HIGHLIGHT_BADGE}`}>
            {t('discount', { percent })}
          </span>
        )}
      </div>

      <p className="mt-4 font-sans-display text-nham-text-soft text-sm leading-relaxed">
        {t(`${base}.fineprint${suffix(period)}`)}
      </p>
    </div>
  );
}
