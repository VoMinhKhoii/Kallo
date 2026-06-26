'use client';

import { useLocale, useTranslations } from 'next-intl';
import type {
  NutrientCardData,
  NutritionDaySeries,
} from '@/lib/nutrition/types';
import { DayStrip } from '../primitives/day-strip';
import {
  findNutrientSeries,
  formatLocalizedNumber,
  shouldShowExceed,
} from '../primitives/helpers';
import { TargetProgressBar } from '../primitives/target-progress-bar';
import { FoodChipRow } from './food-chip-row';

interface NutrientDetailProps {
  card: NutrientCardData;
  daySeries?: NutritionDaySeries;
}

export function NutrientDetail({ card, daySeries }: NutrientDetailProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const locale = useLocale();
  const label = tRoot(card.labelKey);
  const series = findNutrientSeries(daySeries, card.nutrient);

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

      {series && daySeries ? (
        <div className="space-y-1.5">
          <p className="text-[10px] text-nham-text-muted uppercase tracking-[0.16em]">
            {daySeries.unit === 'day'
              ? t('rhythm.timeAxis.byDay')
              : t('rhythm.timeAxis.byWeek')}
          </p>
          <DayStrip series={series} unit={daySeries.unit} label={label} />
        </div>
      ) : null}

      {showChips ? (
        <FoodChipRow nutrient={card.nutrient} variant="spotlight" limit={5} />
      ) : null}
    </div>
  );
}
