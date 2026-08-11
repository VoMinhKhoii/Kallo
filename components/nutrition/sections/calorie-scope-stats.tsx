'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { CalorieAverages, NutritionDayScope } from '@/lib/nutrition/types';
import { formatLocalizedNumber } from '../primitives/helpers';

interface CalorieScopeStatsProps {
  averages: CalorieAverages;
  scope: NutritionDayScope;
  onScopeChange: (scope: NutritionDayScope) => void;
  /** The dates the figure covers, shown under it. */
  dateSpan: string;
  /**
   * Set while a column is selected. The two day scopes describe how to average
   * a RANGE, so one bucket has neither — it shows a single figure and the
   * switch goes away rather than offering a choice that would change nothing.
   */
  selectedValue?: number | null;
  /** A week bucket's figure is still a per-day average; a day's is a total. */
  isWeekBucket?: boolean;
  /**
   * Nothing logged in the range. Both scopes read "—", so the switch would be a
   * choice between two blanks — show the logged-day figure alone.
   */
  isEmpty?: boolean;
}

/**
 * One calorie figure, and a switch that NAMES the other one.
 *
 * The two averages used to sit stacked, the inactive one small underneath with
 * a ⇅ glyph — which showed the number but never said the control was a control,
 * or what tapping it would give you. Now the card shows the scope you are on
 * and offers the other by name, with the arrow pointing the way it moves.
 */
export function CalorieScopeStats({
  averages,
  scope,
  onScopeChange,
  dateSpan,
  selectedValue,
  isWeekBucket = false,
  isEmpty = false,
}: CalorieScopeStatsProps) {
  const t = useTranslations('nutrition');
  const locale = useLocale();

  const onComplete = scope === 'complete';
  const isColumn = selectedValue !== undefined;
  const value = isColumn
    ? selectedValue
    : isEmpty
      ? averages.all.averagePerDay
      : averages[scope].averagePerDay;

  let unitKey: string;
  if (isColumn) {
    unitKey = isWeekBucket ? 'rhythm.kcalPerLoggedDay' : 'rhythm.calories';
  } else if (isEmpty || !onComplete) {
    unitKey = 'rhythm.kcalPerLoggedDay';
  } else {
    unitKey = 'rhythm.kcalPerCompleteDay';
  }

  return (
    <div className="flex flex-col gap-1.5">
      {!(isColumn || isEmpty) && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onScopeChange(onComplete ? 'all' : 'complete')}
            className="-mr-1 inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-medium text-[12px] text-nham-text-muted transition-colors hover:bg-nham-hover hover:text-nham-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
          >
            {/* The arrow points the way the card moves: complete days sit to
                the left of logged days, so each label leads with its
                direction. */}
            {onComplete ? null : (
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {t(onComplete ? 'rhythm.loggedDays' : 'rhythm.completeDays')}
            {onComplete ? (
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            ) : null}
          </button>
        </div>
      )}

      <div>
        <span className="flex items-baseline gap-2 leading-none">
          <span className="font-medium font-sans-display text-4xl text-nham-text tabular-nums tracking-[-0.03em] sm:text-5xl">
            {value === null || value === undefined
              ? '—'
              : formatLocalizedNumber(value, locale)}
          </span>
          {/* The unit carries the denominator — "kcal per complete day" — so
              the figure is never a bare number needing a caption to be read. */}
          <span className="text-lg text-nham-text-muted">{t(unitKey)}</span>
        </span>
        <span className="mt-1.5 block text-[13px] text-nham-text-muted tabular-nums">
          {dateSpan}
        </span>
      </div>
    </div>
  );
}
