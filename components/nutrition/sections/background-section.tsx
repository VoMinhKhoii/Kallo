'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import type { NutrientCardData } from '@/lib/nutrition/types';
import { SectionEyebrow } from '../primitives/section-eyebrow';
import { NutrientRow } from '../rows/nutrient-row';

interface BackgroundSectionProps {
  cards: NutrientCardData[];
}

export function BackgroundSection({ cards }: BackgroundSectionProps) {
  const t = useTranslations('nutrition');
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const panelId = useId();

  if (cards.length === 0) return null;

  const half = Math.ceil(cards.length / 2);
  const left = cards.slice(0, half);
  const right = cards.slice(half);
  const eyebrowLabel = t('background.eyebrow');

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="sr-only">
        {eyebrowLabel}
      </h2>
      <div className="flex items-baseline justify-between gap-4">
        <SectionEyebrow label={eyebrowLabel} delay={0.2} />
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls={panelId}
          className="touch-manipulation font-medium text-nham-text text-xs underline-offset-4 transition-colors hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {open
            ? t('background.hide')
            : t('background.show', { count: cards.length })}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="mb-2 text-[11px] text-nham-text-muted">
              {t('background.hint')}
            </p>
            <div className="overflow-hidden rounded-2xl border border-nham-border/50 bg-card/30">
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
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
