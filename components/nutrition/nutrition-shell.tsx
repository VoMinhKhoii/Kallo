'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { getNutritionOverview } from '@/lib/domain/nutrition/actions/overview/get-overview';
import { buildNutritionView } from '@/lib/domain/nutrition/bucket-detail';
import { nutritionKeys } from '@/lib/domain/nutrition/query-keys';
import type {
  NutritionDayScope,
  NutritionRangeInput,
} from '@/lib/domain/nutrition/types';
import { NutritionSkeleton } from './nutrition-skeleton';
import { DaySummary } from './sections/day-summary';
import { findTodayIndex, localIsoDate } from './sections/macro-trend-utils';
import { NutrientSection } from './sections/nutrient-section';
import { NutritionHeader } from './sections/nutrition-header';
import { SourceAttribution } from './sections/source-attribution';
import { EmptyState } from './states/empty-state';
import { InlineError } from './states/inline-error';
import { useNutritionShellEffects } from './use-nutrition-shell-effects';

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
  const clearSelection = useCallback(() => setSelectedIndex(null), []);
  const today = useMemo(() => localIsoDate(), []);

  const overviewQuery = useQuery({
    queryKey: nutritionKeys.overview(range, dayScope, timezoneOffset ?? 'utc'),
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

  useNutritionShellEffects({
    selectedIndex,
    clearSelection,
    isError,
    error,
    errorToast: overviewErrorToast,
  });

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
  // `activeIndex`, not `selectedIndex`: tapping a column with nothing logged
  // in it resolves to no detail, and the page stays on the range rather than
  // greying every other column around an empty one.
  const {
    macros,
    micronutrients,
    moreNutrients,
    dateSpan,
    selectedIndex: activeIndex,
  } = buildNutritionView(overview, selectedIndex, locale);
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
              // `selectedIndex` is positional, and the bucket axis is rebuilt
              // on a range change — index 3 is a Thursday on 7d and some week
              // in June on 90d. Carrying it over would silently scope the page
              // to a bucket nobody picked. (The Flutter screen does the same.)
              onRangeChange={(next) => {
                setRange(next);
                setSelectedIndex(null);
              }}
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
            {/* `aria-busy` covers the column; `aria-live` does NOT. Announcing
                the whole subtree meant every range change read out the chart,
                the grid and the source line — the figure and its date span are
                what actually changed, and DaySummary marks those. */}
            <div
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
                selectedIndex={activeIndex}
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
              <NutrientSection
                micronutrients={micronutrients}
                moreNutrients={moreNutrients}
                locked={overview.micronutrientsLocked}
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
