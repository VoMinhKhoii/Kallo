'use client';

import { useTranslations } from 'next-intl';
import type { NutrientCardData } from '@/lib/nutrition/types';
import { SectionEyebrow } from './section-eyebrow';
import { SpotlightRow } from './spotlight-row';

interface FocusSectionProps {
  cards: NutrientCardData[];
}

export function FocusSection({ cards }: FocusSectionProps) {
  const t = useTranslations('nutrition');
  if (cards.length === 0) return null;

  const headingId = 'focus-heading';
  const label = t('focus.eyebrow');

  return (
    <section
      aria-labelledby={headingId}
      data-testid="focus-section"
      className="space-y-5"
    >
      <h2 id={headingId} className="sr-only">
        {label}
      </h2>
      <SectionEyebrow label={label} delay={0.15} />
      <div className="space-y-6">
        {cards.map((card, index) => (
          <SpotlightRow
            key={card.nutrient}
            card={card}
            delay={0.1 + index * 0.06}
          />
        ))}
      </div>
    </section>
  );
}
