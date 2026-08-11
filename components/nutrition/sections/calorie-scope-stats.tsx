'use client';

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
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
  /**
   * Nothing logged in the range. Both scopes read "—", so the switch would be a
   * choice between two blanks — show the logged-day figure alone.
   */
  isEmpty?: boolean;
  /**
   * Signed kcal against the SAME-LENGTH window before this one, or null when
   * there is nothing back there to compare with. It qualifies the figure, so it
   * reads immediately after the unit.
   */
  diff?: number | null;
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
  isEmpty = false,
  diff = null,
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

  return (
    <div>
      {/* The figure leads, top-left; the switch takes the opposite corner. */}
      <div className="flex items-start justify-between gap-4">
        <span className="flex flex-wrap items-baseline gap-x-2 leading-none">
          <span className="font-medium font-sans-display text-4xl text-nham-text tabular-nums tracking-[-0.03em] sm:text-5xl">
            {value === null || value === undefined
              ? '—'
              : formatLocalizedNumber(value, locale)}
          </span>
          <span className="text-lg text-nham-text-muted">
            {t('rhythm.calories')}
          </span>
          {/* Against the window before this one — it qualifies the figure, so
              it sits with it rather than down on the caption line. */}
          {diff !== null ? (
            <span className="flex items-center gap-0.5 text-[12px] text-nham-text-muted tabular-nums">
              {diff >= 0 ? (
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {formatLocalizedNumber(Math.abs(diff), locale)}
            </span>
          ) : null}
        </span>

        {!(isColumn || isEmpty) && (
          <button
            type="button"
            onClick={() => onScopeChange(onComplete ? 'all' : 'complete')}
            className="-mt-1 inline-flex shrink-0 items-center gap-1.5 font-medium text-[12px] text-nham-text-muted underline-offset-4 transition-colors hover:text-nham-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
          >
            {/* The arrow points the way the card moves: complete days sit to
                the left of all days, so each label leads with its direction. */}
            {onComplete ? null : (
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {t(onComplete ? 'rhythm.loggedDays' : 'rhythm.completeDays')}
            {onComplete ? (
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            ) : null}
          </button>
        )}
      </div>

      <span className="mt-1.5 block text-[13px] text-nham-text-muted tabular-nums">
        {dateSpan}
      </span>
    </div>
  );
}
