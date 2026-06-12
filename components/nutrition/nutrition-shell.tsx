'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getNutritionOverview } from '@/lib/nutrition/actions';
import type { NutritionRangeInput } from '@/lib/nutrition/types';
import { NutritionSkeleton } from './nutrition-skeleton';
import { BackgroundSection } from './sections/background-section';
import { DailyRhythm } from './sections/daily-rhythm';
import { EditorialHeader } from './sections/editorial-header';
import { FocusSection } from './sections/focus-section';
import { PullQuote } from './sections/pull-quote';
import { SteadySection } from './sections/steady-section';
import { VerdictHero } from './sections/verdict-hero';
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
  const hasShownErrorToast = useRef(false);

  const overviewQuery = useQuery({
    queryKey: ['nutrition', 'overview', range, timezoneOffset ?? 'utc'],
    queryFn: () => getNutritionOverview({ range, timezoneOffset }),
    retry: false,
    // 5 minutes — overview is computed from the user's logged meals which
    // change at most once per logging action; a longer staleTime avoids
    // refetching on every focus/visibility change.
    staleTime: 5 * 60_000,
    // Render the previous range's data while a new range fetches so the
    // editorial layout stays in place rather than collapsing to skeleton.
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
      <main className="flex-1 overflow-y-auto px-5 py-4 sm:px-8">
        <InlineError
          isRetrying={overviewQuery.isFetching}
          message={overviewErrorMessage}
          onRetry={() => {
            void overviewQuery.refetch();
          }}
          retryLabel={overviewRetryLabel}
        />
      </main>
    );
  }

  const overview = overviewQuery.data;
  const resolvedRange = overview.resolvedRange;
  const isEmpty = overview.loggedDays === 0;

  return (
    <MotionConfig reducedMotion="user">
      <main className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 lg:px-12">
        <h1 className="sr-only">{t('title')}</h1>
        <div className="flex flex-col gap-12">
          <EditorialHeader
            resolvedRange={resolvedRange}
            onRangeChange={setRange}
            startDate={overview.period.startDate}
            endDate={overview.period.endDate}
            disabled={overviewQuery.isFetching}
            verdict={isEmpty ? null : <VerdictHero overview={overview} />}
          />

          {isEmpty ? (
            <EmptyState />
          ) : (
            <div
              aria-live="polite"
              aria-busy={overviewQuery.isFetching}
              className="flex flex-col gap-12"
            >
              {overview.spotlight.length > 0 ? (
                <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
                  <div className="lg:col-span-6 xl:col-span-7">
                    <DailyRhythm
                      macros={overview.macros}
                      daySeries={overview.daySeries}
                    />
                  </div>
                  <div className="lg:col-span-6 xl:col-span-5">
                    <FocusSection
                      cards={overview.spotlight}
                      daySeries={overview.daySeries}
                    />
                  </div>
                </div>
              ) : (
                <DailyRhythm
                  macros={overview.macros}
                  daySeries={overview.daySeries}
                />
              )}

              <SteadySection
                cards={overview.steady}
                daySeries={overview.daySeries}
              />

              <BackgroundSection cards={overview.moreNutrients} />

              {overview.educationCards.map((card) => (
                <PullQuote key={card.id} card={card} />
              ))}
            </div>
          )}
        </div>
      </main>
    </MotionConfig>
  );
}
