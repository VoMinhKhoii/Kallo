'use client';

import { Check, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PricingFeature } from './plans';

/**
 * One feature, as Free gets it.
 *
 * A tick on the left for what you get, a dash and a struck-through label for
 * what you don't — so the shape of the free tier reads from the left margin
 * alone, before any word is parsed.
 *
 * Two rows aren't yes-or-no (how many groups, how large) and carry their own
 * wording instead.
 */
export function FeatureRow({ feature }: { feature: PricingFeature }) {
  const t = useTranslations('landing.pricing.features');
  const absent = feature.free === false;

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
        {feature.free === 'value' && (
          <span className="text-nham-text-muted">
            {' — '}
            {t(`${feature.id}.free`)}
          </span>
        )}
      </span>
    </li>
  );
}
