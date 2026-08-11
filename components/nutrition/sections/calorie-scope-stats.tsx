'use client';

import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import type {
  CalorieAverages,
  CalorieScopeAverage,
  NutritionDayScope,
} from '@/lib/nutrition/types';
import { cn } from '@/lib/utils';
import { formatLocalizedNumber } from '../primitives/helpers';

const SWAP_TRANSITION = {
  duration: 0.32,
  ease: [0.33, 1, 0.68, 1],
} as const;

interface CalorieScopeStatsProps {
  averages: CalorieAverages;
  scope: NutritionDayScope;
  onScopeChange: (scope: NutritionDayScope) => void;
  /** The dates each figure covers, shown under it. */
  dateSpan: string;
  /**
   * Set while a column is selected. The two day scopes describe how to average
   * a RANGE, so one bucket has neither — it shows a single figure and the swap
   * goes away rather than offering a choice that would change nothing.
   */
  selectedValue?: number | null;
  /** A week bucket's figure is still a per-day average; a day's is a total. */
  isWeekBucket?: boolean;
}

/**
 * The two calorie averages (complete + all) shown side by side as a
 * toggle-group. The active scope is the emphasized hero figure rendered first
 * (left); the other is a quieter button that promotes it on click. Reordering
 * on scope change animates via motion layout (stable layoutId per scope), so
 * the two entries glide past each other rather than snapping.
 * Ported from the Flutter DaySummary calorie block.
 */
export function CalorieScopeStats({
  averages,
  scope,
  onScopeChange,
  dateSpan,
  selectedValue,
  isWeekBucket = false,
}: CalorieScopeStatsProps) {
  const completeActive = scope === 'complete';

  if (selectedValue !== undefined) {
    return (
      <ScopeEntry
        layoutId="calorie-scope-selected"
        data={{ averagePerDay: selectedValue, days: 1 }}
        unitKey={isWeekBucket ? 'rhythm.kcalPerLoggedDay' : 'rhythm.calories'}
        dateSpan={dateSpan}
        active
        onSelect={() => undefined}
      />
    );
  }

  const completeEntry = (
    <ScopeEntry
      key="complete"
      layoutId="calorie-scope-complete"
      data={averages.complete}
      unitKey="rhythm.kcalPerCompleteDay"
      dateSpan={dateSpan}
      active={completeActive}
      onSelect={() => onScopeChange('complete')}
    />
  );
  const allEntry = (
    <ScopeEntry
      key="all"
      layoutId="calorie-scope-all"
      data={averages.all}
      unitKey="rhythm.kcalPerLoggedDay"
      dateSpan={dateSpan}
      active={!completeActive}
      onSelect={() => onScopeChange('all')}
    />
  );

  // Active entry is always first (left); render order = [active, inactive].
  return (
    <div className="flex items-baseline gap-8">
      {completeActive ? (
        <>
          {completeEntry}
          {allEntry}
        </>
      ) : (
        <>
          {allEntry}
          {completeEntry}
        </>
      )}
    </div>
  );
}

interface ScopeEntryProps {
  data: CalorieScopeAverage;
  unitKey: string;
  dateSpan: string;
  active: boolean;
  onSelect: () => void;
  layoutId: string;
}

function ScopeEntry({
  data,
  unitKey,
  dateSpan,
  active,
  onSelect,
  layoutId,
}: ScopeEntryProps) {
  const t = useTranslations('nutrition');
  const locale = useLocale();

  const valueText =
    data.averagePerDay !== null
      ? formatLocalizedNumber(data.averagePerDay, locale)
      : '—';

  return (
    <motion.div
      layout="position"
      layoutId={layoutId}
      transition={SWAP_TRANSITION}
    >
      <button
        type="button"
        aria-pressed={active}
        onClick={active ? undefined : onSelect}
        className="rounded-md text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2 focus-visible:ring-offset-nham-surface"
      >
        <span className="flex items-baseline gap-2 leading-none">
          <span
            className={cn(
              'font-medium font-sans-display tabular-nums tracking-[-0.03em]',
              active
                ? 'text-4xl text-nham-text sm:text-5xl'
                : 'text-lg text-nham-text-muted'
            )}
          >
            {valueText}
          </span>
          {/* The unit carries the denominator — "kcal per complete day" — so the
              figure is never a bare number needing a caption to be read. */}
          <span
            className={cn(
              'text-nham-text-muted',
              active ? 'text-lg' : 'text-sm'
            )}
          >
            {t(unitKey)}
          </span>
        </span>
        <span className="mt-1.5 block text-[13px] text-nham-text-muted tabular-nums">
          {dateSpan}
        </span>
      </button>
    </motion.div>
  );
}
