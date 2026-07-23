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
}: CalorieScopeStatsProps) {
  const completeActive = scope === 'complete';

  const completeEntry = (
    <ScopeEntry
      key="complete"
      layoutId="calorie-scope-complete"
      data={averages.complete}
      labelKey="rhythm.avgPerCompleteDay"
      active={completeActive}
      onSelect={() => onScopeChange('complete')}
    />
  );
  const allEntry = (
    <ScopeEntry
      key="all"
      layoutId="calorie-scope-all"
      data={averages.all}
      labelKey="rhythm.avgPerLoggedDay"
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
  labelKey: string;
  active: boolean;
  onSelect: () => void;
  layoutId: string;
}

function ScopeEntry({
  data,
  labelKey,
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
  const label = `${t(labelKey)} · ${t('rhythm.dayCount', { count: data.days })}`;

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
          <span
            className={cn(
              'text-nham-text-muted',
              active ? 'text-base' : 'text-xs'
            )}
          >
            {t('rhythm.calories')}
          </span>
        </span>
        <span className="mt-1.5 block font-medium text-[11px] text-nham-text-muted uppercase tracking-[0.08em]">
          {label}
        </span>
      </button>
    </motion.div>
  );
}
