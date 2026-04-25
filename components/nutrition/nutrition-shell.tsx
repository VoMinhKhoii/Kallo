'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { getNutritionOverview } from '@/lib/nutrition/actions';
import type { NutritionRangeInput } from '@/lib/nutrition/types';
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
  const tCommon = useTranslations('common');
  const timezoneOffset = useMemo(() => getTimezoneOffset(), []);
  const [range, setRange] = useState<NutritionRangeInput>('auto');

  const overviewQuery = useQuery({
    queryKey: ['nutrition', 'overview', range, timezoneOffset ?? 'utc'],
    queryFn: () => getNutritionOverview({ range, timezoneOffset }),
    staleTime: 60_000,
  });

  const resolvedRange = overviewQuery.data?.resolvedRange ?? '30d';

  if (overviewQuery.isLoading) return <NutritionSkeleton />;

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <main className="flex-1 overflow-y-auto px-5 py-4 sm:px-8">
        <div
          role="alert"
          className="rounded-2xl border border-nham-border/60 bg-card p-4 text-nham-text"
        >
          <p>{t('errors.overview')}</p>
          <button
            type="button"
            onClick={() => overviewQuery.refetch()}
            disabled={overviewQuery.isFetching}
            aria-busy={overviewQuery.isFetching}
            className="mt-3 inline-flex touch-manipulation items-center rounded-xl border border-nham-border/60 px-4 py-2 font-medium text-nham-text text-sm transition-colors hover:bg-nham-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2 focus-visible:ring-offset-nham-surface disabled:opacity-50"
          >
            {tCommon('retry')}
          </button>
        </div>
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
          <section className="rounded-3xl border border-nham-border/60 bg-card p-6">
            <h2 className="font-semibold text-lg text-nham-text">
              {t('empty.title')}
            </h2>
            <p className="mt-2 max-w-2xl text-nham-text-muted text-sm leading-6">
              {t('empty.description')}
            </p>
            <Link
              href="/logging"
              className="mt-4 inline-flex touch-manipulation items-center rounded-xl bg-nham-btn px-4 py-2 font-medium text-card text-sm transition-colors hover:bg-nham-btn-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2 focus-visible:ring-offset-nham-surface"
            >
              {t('empty.logMeal')}
            </Link>
          </section>
        ) : (
          <div
            aria-live="polite"
            aria-busy={overviewQuery.isFetching}
            className="contents"
          >
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
