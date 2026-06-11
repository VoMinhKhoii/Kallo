'use client';

import { useTranslations } from 'next-intl';
import type { NutrientCardData } from '@/lib/nutrition/types';
import { NutrientRow } from '../rows/nutrient-row';

interface SteadySectionProps {
  cards: NutrientCardData[];
}

export function SteadySection({ cards }: SteadySectionProps) {
  const t = useTranslations('nutrition');
  if (cards.length === 0) return null;

  const half = Math.ceil(cards.length / 2);
  const left = cards.slice(0, half);
  const right = cards.slice(half);
  const headingId = 'steady-heading';
  const eyebrowLabel = t('steady.eyebrow');

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="sr-only">
        {eyebrowLabel}
      </h2>
      <div className="flex items-baseline justify-end gap-4">
        <p className="text-[11px] text-nham-text-muted">{t('steady.hint')}</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-nham-border/50 bg-white">
        <div className="grid sm:grid-cols-2">
          <ul>
            {left.map((card) => (
              <NutrientRow key={card.nutrient} card={card} />
            ))}
          </ul>
          {right.length > 0 ? (
            <ul className="sm:border-nham-border/40 sm:border-l">
              {right.map((card) => (
                <NutrientRow key={card.nutrient} card={card} />
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
