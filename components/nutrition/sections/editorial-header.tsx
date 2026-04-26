'use client';

import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type {
  NutritionRange,
  NutritionRangeInput,
} from '@/lib/nutrition/types';
import { cn } from '@/lib/utils';
import { SectionEyebrow } from '../primitives/section-eyebrow';

const RANGES = [
  '7d',
  '30d',
  '90d',
] as const satisfies readonly NutritionRange[];

interface EditorialHeaderProps {
  resolvedRange: NutritionRange;
  onRangeChange: (range: NutritionRangeInput) => void;
  startDate: string;
  endDate: string;
  disabled?: boolean;
  /**
   * Optional inline verdict node rendered between the title block and the
   * range toggle on lg+, and pushed to a second row on smaller screens.
   */
  verdict?: ReactNode;
}

function formatDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

export function EditorialHeader({
  resolvedRange,
  onRangeChange,
  startDate,
  endDate,
  disabled,
  verdict,
}: EditorialHeaderProps) {
  const t = useTranslations('nutrition');
  const tRange = useTranslations('nutrition.range');
  const locale = useLocale();
  const dateRange = t('editorial.dateRange', {
    start: formatDate(startDate, locale),
    end: formatDate(endDate, locale),
  });

  return (
    <header
      className={cn(
        'grid items-center gap-x-6 gap-y-4 border-nham-border/50 border-b pb-5',
        verdict
          ? 'grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[auto_minmax(0,1fr)_auto]'
          : 'grid-cols-[minmax(0,1fr)_auto]'
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="col-start-1 row-start-1 min-w-0"
      >
        <SectionEyebrow
          label={t('editorial.eyebrow')}
          trailing={tRange(resolvedRange)}
        />
        <p className="mt-2 text-nham-text-muted text-sm tabular-nums">
          {dateRange}
        </p>
      </motion.div>

      {verdict ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="col-span-2 row-start-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:px-6"
        >
          {verdict}
        </motion.div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        role="group"
        aria-label={tRange('label')}
        className={cn(
          'col-start-2 row-start-1 inline-flex items-center gap-px justify-self-end rounded-full border border-nham-border/60 bg-card/40 p-1',
          verdict ? 'lg:col-start-3' : ''
        )}
      >
        {RANGES.map((range) => {
          const active = resolvedRange === range;
          return (
            <button
              key={range}
              type="button"
              aria-pressed={active}
              onClick={() => onRangeChange(range)}
              disabled={disabled}
              className={cn(
                'touch-manipulation rounded-full px-3 py-1.5 font-medium text-[12px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2 focus-visible:ring-offset-nham-surface disabled:opacity-60',
                active
                  ? 'bg-nham-text text-nham-surface'
                  : 'text-nham-text-muted hover:text-nham-text'
              )}
            >
              {tRange(range)}
            </button>
          );
        })}
      </motion.div>
    </header>
  );
}
