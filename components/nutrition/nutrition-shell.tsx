'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getNutritionOverview } from '@/lib/nutrition/actions';
import { buildNutritionView } from '@/lib/nutrition/bucket-detail';
import type {
  NutritionDayScope,
  NutritionRangeInput,
} from '@/lib/nutrition/types';
import { NutritionSkeleton } from './nutrition-skeleton';
import { DaySummary } from './sections/day-summary';
import { findTodayIndex, localIsoDate } from './sections/macro-trend-utils';
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
  const locale = useLocale();
  const timezoneOffset = useMemo(() => getTimezoneOffset(), []);
  const [range, setRange] = useState<NutritionRangeInput>('auto');
  const [dayScope, setDayScope] = useState<NutritionDayScope>('complete');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const hasShownErrorToast = useRef(false);
  const today = useMemo(() => localIsoDate(), []);

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

  // Tapping a column re-points the WHOLE page at that bucket — the calorie
  // hero, the gram legend and the nutrient grid — rather than opening a second
  // panel that repeats them. Tapping anywhere else puts the range back.
  const { macros, micronutrients, moreNutrients, dateSpan } =
    buildNutritionView(overview, selectedIndex, locale);
  const todayIndex = findTodayIndex(
    overview.daySeries.series[0]?.buckets ?? [],
    today
  );

  return (
    <MotionConfig reducedMotion="user">
      <main className="flex min-h-0 flex-1 flex-col">
        {/* Padding lives on the outer div so the inner max-w column aligns
            with the content cards' column below. */}
        <div className="shrink-0 px-4 pt-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-3 w-full max-w-2xl">
            <NutritionHeader
              resolvedRange={range === 'auto' ? overview.resolvedRange : range}
              onRangeChange={setRange}
              disabled={overviewQuery.isFetching}
            />
          </div>
        </div>

        {/* A click anywhere off the chart clears the selection; the chart stops
            propagation. It is a dismissal, not a control — everything inside
            stays reachable — and Escape does the same job from the keyboard. */}
        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-20 sm:px-6 lg:px-8"
          onClick={() => setSelectedIndex(null)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setSelectedIndex(null);
          }}
        >
          <div className="mx-auto flex min-h-full max-w-2xl flex-col">
            <div
              aria-live="polite"
              aria-busy={overviewQuery.isFetching}
              className="flex flex-1 flex-col gap-7"
            >
              <DaySummary
                macros={macros}
                daySeries={overview.daySeries}
                resolvedRange={overview.resolvedRange}
                calorieAverages={overview.calorieAverages}
                previousCalorieAverages={overview.previousCalorieAverages}
                scope={dayScope}
                onScopeChange={setDayScope}
                dateSpan={dateSpan}
                isEmpty={overview.loggedDays === 0}
                todayIndex={todayIndex}
                selectedIndex={selectedIndex}
                onSelect={(index) =>
                  setSelectedIndex((current) =>
                    current === index ? null : index
                  )
                }
              />
              {/* Nothing logged yet: the page keeps its shape at zero and the
                  prompt sits under the card rather than replacing everything,
                  so the layout someone will use every day is what they see
                  first. */}
              {overview.loggedDays === 0 ? <EmptyState /> : null}
              <NutrientGrid
                micronutrients={micronutrients}
                moreNutrients={moreNutrients}
              />
              {/* The source line belongs to the page, not to the last section
                  above it — `mt-auto` keeps it on the bottom edge when the
                  content is short instead of floating mid-screen. */}
              <div className="mt-auto pt-7">
                <SourceAttribution />
              </div>
            </div>
          </div>
        </div>
      </main>
    </MotionConfig>
  );
}
