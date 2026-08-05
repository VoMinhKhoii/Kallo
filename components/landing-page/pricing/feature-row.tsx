'use client';

import { Check, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  availabilityFor,
  type PlanId,
  type PricingFeature,
  valueKeyFor,
} from './plans';

/**
 * One feature on one plan.
 *
 * A tick on the left for what you get, a dash and a struck-through label for
 * what you don't — so the shape of a plan reads from the left margin alone,
 * before any word is parsed.
 *
 * Two rows aren't yes-or-no (how many groups, how large) and carry the plan's
 * own wording instead. The source table marked those "✓" on the paid columns,
 * which tells the reader nothing.
 */
export function FeatureRow({
  feature,
  plan,
}: {
  feature: PricingFeature;
  plan: PlanId;
}) {
  const t = useTranslations('landing.pricing.features');
  const state = availabilityFor(feature, plan);
  const absent = state === false;

  return (
    <li className="flex items-start gap-2.5">
      {absent ? (
        <Minus
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0 text-nham-text-muted/50"
        />
      ) : (
        <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-nham-text" />
      )}
      <span
        className={`font-sans-display text-sm leading-snug ${
          absent ? 'text-nham-text-muted line-through' : 'text-nham-text-soft'
        }`}
      >
        {t(`${feature.id}.label`)}
        {state === 'value' && (
          <span className="text-nham-text-muted">
            {' — '}
            {t(`${feature.id}.${valueKeyFor(plan)}`)}
          </span>
        )}
      </span>
    </li>
  );
}
