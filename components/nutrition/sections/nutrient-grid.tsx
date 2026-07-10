'use client';

import { useTranslations } from 'next-intl';
import type { NutrientCardData } from '@/lib/nutrition/types';
import { NutrientGridCard } from '../rows/nutrient-grid-card';

interface NutrientGridProps {
  micronutrients: NutrientCardData[];
  moreNutrients: NutrientCardData[];
}

/**
 * The micronutrient overview — every tracked nutrient in a 2-column grid,
 * grouped Vitamins then Minerals with an inline progress bar per cell. The
 * lean Flutter nutrition layout: dense but scannable, no per-nutrient
 * expand/collapse rows.
 */
export function NutrientGrid({
  micronutrients,
  moreNutrients,
}: NutrientGridProps) {
  const t = useTranslations('nutrition');
  const all = [...micronutrients, ...moreNutrients];
  const vitamins = all.filter((c) => c.group === 'vitamin');
  const minerals = all.filter((c) => c.group !== 'vitamin');

  return (
    <div className="flex flex-col gap-7">
      {vitamins.length > 0 ? (
        <Group label={t('grid.vitamins')} cards={vitamins} />
      ) : null}
      {minerals.length > 0 ? (
        <Group label={t('grid.minerals')} cards={minerals} />
      ) : null}
    </div>
  );
}

function Group({ label, cards }: { label: string; cards: NutrientCardData[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-[11px] text-nham-text-muted uppercase tracking-[0.08em]">
        {label}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card, index) => (
          <NutrientGridCard
            key={card.nutrient}
            card={card}
            barDelay={0.06 * index}
          />
        ))}
      </div>
    </section>
  );
}
