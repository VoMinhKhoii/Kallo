'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { NutrientCardData } from '@/lib/nutrition/types';
import { formatLocalizedNumber, shouldShowExceed } from '../primitives/helpers';
import { TargetProgressBar } from '../primitives/target-progress-bar';
import { FoodChipRow } from './food-chip-row';

interface NutrientDetailProps {
  card: NutrientCardData;
}

export function NutrientDetail({ card }: NutrientDetailProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const locale = useLocale();
  const label = tRoot(card.labelKey);

  const hasTarget = card.percentOfTarget !== null;
  const percent = card.percentOfTarget ?? 0;
  const showExceed = shouldShowExceed(card.nutrientType, card.percentOfTarget);

  const avgText =
    card.averagePerDay === null
      ? null
      : t('focus.averageLine', {
          value: formatLocalizedNumber(card.averagePerDay, locale),
          unit: card.unit,
          source: tRoot(card.targetSourceLabelKey),
        });

  const showChips =
    card.supportsCandidates &&
    card.confidence >= 40 &&
    card.percentOfTarget !== null &&
    card.percentOfTarget < 90;

  return (
    <div className="space-y-4 pt-2">
      {hasTarget ? (
        <>
          <div className="flex items-center gap-3">
            <TargetProgressBar
              percentOfTarget={card.percentOfTarget}
              showExceed={showExceed}
              duration={0.55}
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

          {avgText ? (
            <p className="font-medium text-nham-text text-sm tabular-nums">
              {avgText}
            </p>
          ) : null}
        </>
      ) : avgText ? (
        <p className="font-medium text-nham-text text-sm tabular-nums">
          {avgText}
        </p>
      ) : (
        <p className="text-nham-text-muted text-sm">{t('card.noData')}</p>
      )}

      {showChips ? (
        <FoodChipRow nutrient={card.nutrient} variant="spotlight" limit={5} />
      ) : null}
    </div>
  );
}
