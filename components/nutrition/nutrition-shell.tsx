'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { getNutritionOverview } from '@/lib/nutrition/actions';
import type { NutritionRangeInput } from '@/lib/nutrition/types';
import { EmptyState } from './empty-state';
import { InlineError } from './inline-error';
import { MacroPatternSection } from './macro-pattern-section';
import { NutrientGrid } from './nutrient-grid';
import { NutritionSkeleton } from './nutrition-skeleton';
import { RangeSelector } from './range-selector';
import { SummaryStrip } from './summary-strip';

function getTimezoneOffset(): number | null {
  if (typeof window === 'undefined') return null;

  return new Date().getTimezoneOffset();
}

export function NutritionShell() {
  const t = useTranslations('nutrition');
  const timezoneOffset = useMemo(() => getTimezoneOffset(), []);
  const [range, setRange] = useState<NutritionRangeInput>('auto');

  const overviewQuery = useQuery({
    queryKey: ['nutrition', 'overview', range, timezoneOffset ?? 'utc'],
    queryFn: () => getNutritionOverview({ range, timezoneOffset }),
    retry: false,
    staleTime: 60_000,
  });
  const { isError } = overviewQuery;

  useEffect(() => {
    if (isError) {
      toast.error(t('errors.overview'));
    }
  }, [isError, t]);

  const resolvedRange = overviewQuery.data?.resolvedRange ?? '30d';

  if (overviewQuery.isLoading) return <NutritionSkeleton />;

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <main className="flex-1 overflow-y-auto px-5 py-4 sm:px-8">
        <InlineError
          isRetrying={overviewQuery.isFetching}
          onRetry={() => {
            void overviewQuery.refetch();
          }}
        />
      </main>
    );
  }

  const overview = overviewQuery.data;

  return (
    <main className="flex-1 overflow-y-auto px-5 py-4 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-balance font-bold text-2xl text-nham-text tracking-[-0.02em]">
              {t('title')}
            </h1>
            <p className="mt-2 max-w-2xl text-nham-text-muted text-sm leading-6">
              {t('subtitle')}
            </p>
          </div>
          <RangeSelector
            value={resolvedRange}
            onChange={setRange}
            disabled={overviewQuery.isFetching}
          />
        </header>

        {overview.loggedDays === 0 ? (
          <EmptyState />
        ) : (
          <div
            aria-live="polite"
            aria-busy={overviewQuery.isFetching}
            className="contents"
          >
            {overview.trendStatus === 'too_few_logged_days' ? (
              <p className="rounded-2xl border border-nham-border/60 bg-nham-hover/35 p-4 text-nham-text-muted text-sm">
                {t('trends.tooFewDays')}
              </p>
            ) : null}
            <SummaryStrip summary={overview.summary} />
            <MacroPatternSection macros={overview.macros} />
            <NutrientGrid
              overview={overview}
              resolvedRange={resolvedRange}
              timezoneOffset={timezoneOffset}
            />
          </div>
        )}
      </div>
    </main>
  );
}
