'use client';

import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { formatLocalizedNumber } from '../primitives/helpers';
import {
  type BucketDetail as BucketDetailData,
  type BucketMetric,
  formatBucketRange,
} from './bucket-detail-utils';

interface BucketDetailProps {
  detail: BucketDetailData;
  /** Week buckets read as a per-day average; day buckets are the day itself. */
  isWeekBucket: boolean;
  onClose: () => void;
}

/**
 * The breakdown for one tapped column: macros on top, then that bucket's
 * micronutrients as percentages of target. Every figure is read from the
 * `daySeries` the page already loaded, so opening this costs no request.
 */
export function BucketDetail({
  detail,
  isWeekBucket,
  onClose,
}: BucketDetailProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const locale = useLocale();

  const calories = detail.macros.find((m) => m.metric === 'calories');
  const macros = detail.macros.filter((m) => m.metric !== 'calories');
  const percent = (value: number) => t('steady.percent', { value });

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mt-4 rounded-2xl border border-nham-border bg-nham-surface p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-[13px] text-nham-text">
            {formatBucketRange(detail, locale)}
          </p>
          {calories ? (
            <p className="mt-0.5 text-[12px] text-nham-text-muted tabular-nums">
              {formatLocalizedNumber(calories.value, locale)}{' '}
              {t('rhythm.calories')}
              {isWeekBucket ? ` · ${t('detail.perDay')}` : ''}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('detail.close')}
          className="-mt-1 -mr-1 shrink-0 rounded-full p-1.5 text-nham-text-muted transition-colors hover:bg-nham-hover hover:text-nham-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {macros.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          {macros.map((macro) => (
            <span
              key={macro.metric}
              className="text-[12px] text-nham-text tabular-nums"
            >
              {tRoot(macro.labelKey)}{' '}
              {formatLocalizedNumber(macro.value, locale)}
              {macro.unit}
            </span>
          ))}
        </div>
      ) : null}

      {detail.nutrients.length > 0 ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1.5 border-nham-border border-t pt-3">
          {detail.nutrients.map((nutrient) => (
            <div
              key={nutrient.metric}
              className="flex items-baseline justify-between gap-2"
            >
              <dt className="truncate text-[12px] text-nham-text-muted">
                {tRoot(nutrient.labelKey)}
              </dt>
              <dd className="shrink-0 text-[12px] text-nham-text tabular-nums">
                {figureFor(nutrient, locale, percent)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-[12px] text-nham-text-muted">
          {t('detail.noNutrients')}
        </p>
      )}
    </motion.div>
  );
}

function figureFor(
  nutrient: BucketMetric,
  locale: string,
  percent: (value: number) => string
): string {
  if (nutrient.percentOfTarget === null) {
    return `${formatLocalizedNumber(nutrient.value, locale)} ${nutrient.unit}`;
  }
  return percent(Math.round(nutrient.percentOfTarget));
}
