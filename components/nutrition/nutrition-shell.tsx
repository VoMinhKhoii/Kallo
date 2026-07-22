'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getNutritionOverview } from '@/lib/nutrition/actions';
import type {
  NutritionDayScope,
  NutritionRangeInput,
} from '@/lib/nutrition/types';
import { NutritionSkeleton } from './nutrition-skeleton';
import { DaySummary } from './sections/day-summary';
import { NutrientGrid } from './sections/nutrient-grid';
import { NutritionHeader } from './sections/nutrition-header';
import { SourceAttribution } from './sections/source-attribution';
import { EmptyState } from './states/empty-state';
import { InlineError } from './states/inline-error';

function getTimezoneOffset(): number | null {
  if (typeof window === 'undefined') return null;
  return new Date().getTimezoneOffset();
}

export function NutritionShell() {
  const t = useTranslations('nutrition');
  const timezoneOffset = useMemo(() => getTimezoneOffset(), []);
  const [range, setRange] = useState<NutritionRangeInput>('auto');
  const [dayScope, setDayScope] = useState<NutritionDayScope>('complete');
  const hasShownErrorToast = useRef(false);

  const overviewQuery = useQuery({
    queryKey: [
      'nutrition',
      'overview',
      range,
      dayScope,
      timezoneOffset ?? 'utc',
    ],
    queryFn: () =>
      getNutritionOverview({ range, timezoneOffset, days: dayScope }),
    retry: false,
    // 5 minutes — overview is computed from the user's logged meals which
    // change at most once per logging action; a longer staleTime avoids
    // refetching on every focus/visibility change.
    staleTime: 5 * 60_000,
    // Render the previous range's data while a new range fetches so the
    // layout stays in place rather than collapsing to skeleton.
    placeholderData: keepPreviousData,
  });
  const { isError, error } = overviewQuery;
  const overviewErrorMessage = t('errors.overview');
  const overviewErrorToast = t('errors.overviewToast');
  const overviewRetryLabel = t('errors.retry');

  useEffect(() => {
    if (!isError) {
      hasShownErrorToast.current = false;
      return;
    }
    if (hasShownErrorToast.current) return;
    hasShownErrorToast.current = true;
    console.error('[nutrition] overview query failed', error);
    toast.error(overviewErrorToast);
  }, [isError, error, overviewErrorToast]);

  if (overviewQuery.isLoading) return <NutritionSkeleton />;

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <InlineError
            isRetrying={overviewQuery.isFetching}
            message={overviewErrorMessage}
            onRetry={() => {
              void overviewQuery.refetch();
            }}
            retryLabel={overviewRetryLabel}
          />
        </div>
      </main>
    );
  }

  const overview = overviewQuery.data;
  const isEmpty = overview.loggedDays === 0;

  return (
    <MotionConfig reducedMotion="user">
      <main className="flex min-h-0 flex-1 flex-col">
        {/* Padding lives on the outer div so the inner max-w column aligns
            with the content cards' column below. */}
        <div className="shrink-0 px-4 pt-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-3 w-full max-w-2xl">
            <NutritionHeader
              resolvedRange={overview.resolvedRange}
              onRangeChange={setRange}
              disabled={overviewQuery.isFetching}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto flex min-h-full max-w-2xl flex-col">
            {isEmpty ? (
              <div className="flex flex-1 items-center justify-center">
                <EmptyState />
              </div>
            ) : (
              <div
                aria-live="polite"
                aria-busy={overviewQuery.isFetching}
                className="flex flex-col gap-7"
              >
                <DaySummary
                  macros={overview.macros}
                  daySeries={overview.daySeries}
                  resolvedRange={overview.resolvedRange}
                  calorieAverages={overview.calorieAverages}
                  scope={dayScope}
                  onScopeChange={setDayScope}
                />
                <NutrientGrid
                  micronutrients={overview.micronutrients}
                  moreNutrients={overview.moreNutrients}
                />
                <SourceAttribution />
              </div>
            )}
          </div>
        </div>
      </main>
    </MotionConfig>
  );
}
