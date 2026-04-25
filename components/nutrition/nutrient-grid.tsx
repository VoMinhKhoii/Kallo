'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { NutritionOverview, NutritionRange } from '@/lib/nutrition/types';
import { NutrientCard } from './nutrient-card';
import { VitaminDCard } from './vitamin-d-card';

interface NutrientGridProps {
  overview: NutritionOverview;
  resolvedRange: NutritionRange;
  timezoneOffset: number | null;
}

export function NutrientGrid({
  overview,
  resolvedRange,
  timezoneOffset,
}: NutrientGridProps) {
  const t = useTranslations('nutrition');
  const [showMore, setShowMore] = useState(false);
  const moreNutrientsPanelId = 'more-nutrients-panel';

  return (
    <section className="space-y-4" aria-labelledby="nutrient-grid-title">
      <div>
        <h2
          id="nutrient-grid-title"
          className="font-semibold text-lg text-nham-text"
        >
          {t('grid.title')}
        </h2>
        <p className="mt-1 max-w-2xl text-nham-text-muted text-sm">
          {t('grid.description')}
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {overview.micronutrients.map((card) => (
          <NutrientCard
            key={card.nutrient}
            card={card}
            resolvedRange={resolvedRange}
            timezoneOffset={timezoneOffset}
          />
        ))}
      </div>

      {overview.moreNutrients.length > 0 ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowMore((current) => !current)}
            aria-expanded={showMore}
            aria-controls={moreNutrientsPanelId}
            className="inline-flex touch-manipulation items-center rounded-xl border border-nham-border/60 px-4 py-2 font-medium text-nham-text text-sm transition-colors hover:bg-nham-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2 focus-visible:ring-offset-nham-surface"
          >
            {showMore ? t('more.hide') : t('more.show')}
          </button>

          <div id={moreNutrientsPanelId}>
            {showMore ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {overview.moreNutrients.map((card) => (
                  <NutrientCard
                    key={card.nutrient}
                    card={card}
                    resolvedRange={resolvedRange}
                    timezoneOffset={timezoneOffset}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {overview.educationCards.map((card) => (
        <VitaminDCard key={card.id} card={card} />
      ))}
    </section>
  );
}
