'use client';

import { MacroSummarySkeleton } from '@/components/logging/feed/feed-day-states';
import { MacroSummary } from '@/components/logging/feed/macro-summary';
import { PartialDayNotice } from '@/components/logging/feed/partial-day/partial-day-notice';
import { TodayClose } from '@/components/logging/feed/partial-day/today-close';
import type { IncompleteTotals, MacroBreakdown } from '@/lib/core/types/meal';
import type { Goal } from '@/lib/domain/onboarding/types';

interface FeedHeaderProps {
  isDayLoading: boolean;
  isDayError: boolean;
  incompleteTotals: IncompleteTotals;
  dailyTotals: MacroBreakdown;
  targets: MacroBreakdown;
  showPartialDayNotice: boolean;
  /** Today with a saved meal: offer "I've eaten enough" (or show it closed). */
  showTodayClose: boolean;
  isDayClosed: boolean;
  calorieTarget: number;
  goal: Goal | null;
  onMarkDayComplete: () => void;
  isMarkingDayComplete: boolean;
}

/**
 * The day's macro-summary strip, plus the past-day "partial day" notice or
 * today's "I've eaten enough".
 */
export function FeedHeader({
  isDayLoading,
  isDayError,
  incompleteTotals,
  dailyTotals,
  targets,
  showPartialDayNotice,
  showTodayClose,
  isDayClosed,
  calorieTarget,
  goal,
  onMarkDayComplete,
  isMarkingDayComplete,
}: FeedHeaderProps) {
  return (
    <>
      <div
        className="shrink-0 bg-kallo-surface px-3 pt-3 pb-2 sm:px-6 sm:pt-4 sm:pb-3 dark:bg-transparent"
        data-testid="macro-summary-region"
      >
        {/* The size container the loading placeholder reads its height from
            (feed-day-states), so it matches the strip at this width. */}
        <div className="@container mx-auto max-w-3xl">
          {isDayLoading ? (
            <MacroSummarySkeleton />
          ) : isDayError ? null : (
            <MacroSummary
              goal={goal}
              incomplete={incompleteTotals}
              targets={targets}
              totals={dailyTotals}
            />
          )}
        </div>
      </div>

      {showTodayClose && (
        <div className="shrink-0 px-3 pb-1 sm:px-6">
          <div className="mx-auto flex max-w-3xl justify-end">
            <TodayClose
              calories={dailyTotals.calories}
              closed={isDayClosed}
              isClosing={isMarkingDayComplete}
              onClose={onMarkDayComplete}
            />
          </div>
        </div>
      )}

      {showPartialDayNotice && (
        <div className="shrink-0 px-3 pb-2 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <PartialDayNotice
              calories={dailyTotals.calories}
              isMarkingComplete={isMarkingDayComplete}
              onMarkComplete={onMarkDayComplete}
              target={calorieTarget}
            />
          </div>
        </div>
      )}
    </>
  );
}
