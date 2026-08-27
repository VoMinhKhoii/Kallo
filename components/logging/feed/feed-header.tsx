'use client';

import { useTranslations } from 'next-intl';
import { MacroSummarySkeleton } from '@/components/logging/feed/feed-day-states';
import { MacroSummary } from '@/components/logging/feed/macro-summary';
import { PartialDayNotice } from '@/components/logging/feed/partial-day/partial-day-notice';
import type { MacroBreakdown } from '@/lib/core/types/meal';
import type { Goal } from '@/lib/domain/onboarding/types';

interface FeedHeaderProps {
  isDayLoading: boolean;
  isDayError: boolean;
  hasUnknownDailyMacros: boolean;
  dailyTotals: MacroBreakdown;
  targets: MacroBreakdown;
  showPartialDayNotice: boolean;
  calorieTarget: number;
  goal: Goal | null;
}

/** The day's macro-summary strip plus the past-day "partial day" notice. */
export function FeedHeader({
  isDayLoading,
  isDayError,
  hasUnknownDailyMacros,
  dailyTotals,
  targets,
  showPartialDayNotice,
  calorieTarget,
  goal,
}: FeedHeaderProps) {
  const t = useTranslations('logging.feedArea');

  return (
    <>
      <div
        className="shrink-0 bg-kallo-surface px-3 pt-3 pb-2 sm:px-6 sm:pt-4 sm:pb-3"
        data-testid="macro-summary-region"
      >
        <div className="mx-auto max-w-3xl">
          {isDayLoading ? (
            <MacroSummarySkeleton />
          ) : isDayError ? null : hasUnknownDailyMacros ? (
            <div className="font-medium font-sans-display text-[11px] text-kallo-text-muted/80">
              {t('legacyMacroWarning')}
            </div>
          ) : (
            <MacroSummary goal={goal} targets={targets} totals={dailyTotals} />
          )}
        </div>
      </div>

      {showPartialDayNotice && (
        <div className="shrink-0 px-3 pb-2 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <PartialDayNotice
              calories={dailyTotals.calories}
              target={calorieTarget}
            />
          </div>
        </div>
      )}
    </>
  );
}
