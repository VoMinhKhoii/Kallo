'use client';

import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import type { NutrientCardData } from '@/lib/nutrition/types';
import { cn } from '@/lib/utils';
import { formatLocalizedNumber, shouldShowExceed } from '../primitives/helpers';
import { TargetProgressBar } from '../primitives/target-progress-bar';
import { FoodChipRow } from './food-chip-row';

interface SpotlightRowProps {
  card: NutrientCardData;
  delay?: number;
}

export function SpotlightRow({ card, delay = 0 }: SpotlightRowProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const locale = useLocale();
  const label = tRoot(card.labelKey);
  const percent = card.percentOfTarget ?? 0;
  const showExceed = shouldShowExceed(card.nutrientType, card.percentOfTarget);
  const figure =
    showExceed && percent > 100
      ? `+${Math.round(percent - 100)}%`
      : t('focus.percentOfTarget', { value: Math.round(percent) });

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="space-y-3 border-nham-border/40 border-b pb-6 last:border-b-0 last:pb-0"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3
          className="text-nham-text"
          style={{
            fontFamily: 'Lora, serif',
            fontWeight: 500,
            fontSize: 'clamp(1.25rem, 0.95rem + 1.4vw, 1.6rem)',
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </h3>
        <p
          className={cn(
            'shrink-0 font-medium text-sm tabular-nums',
            showExceed ? 'text-nham-danger' : 'text-nham-text'
          )}
        >
          {figure}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <TargetProgressBar
          percentOfTarget={card.percentOfTarget}
          showExceed={showExceed}
          delay={delay + 0.1}
          ariaLabel={t('focus.spotlightBarAria', {
            label,
            pct: Math.round(percent),
          })}
        />
        {card.target === null ? null : (
          <span className="shrink-0 text-[11px] text-nham-text-muted tabular-nums">
            {`${formatLocalizedNumber(card.target, locale)} ${card.unit}`}
          </span>
        )}
      </div>

      <p className="font-medium text-nham-text text-sm tabular-nums">
        {t('focus.averageLine', {
          value:
            card.averagePerDay === null
              ? '—'
              : formatLocalizedNumber(card.averagePerDay, locale),
          unit: card.unit,
          source: tRoot(card.targetSourceLabelKey),
        })}
      </p>

      <FoodChipRow nutrient={card.nutrient} variant="spotlight" limit={5} />
    </motion.article>
  );
}
