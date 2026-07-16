'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { NutrientCardData } from '@/lib/nutrition/types';
import { cn } from '@/lib/utils';
import { formatLocalizedNumber, shouldShowExceed } from '../primitives/helpers';
import { TargetProgressBar } from '../primitives/target-progress-bar';

interface NutrientGridCardProps {
  card: NutrientCardData;
  /** Stagger so a row of bars fills in sequence. */
  barDelay?: number;
}

/**
 * Whether a nutrient reads as "on target" for the green-card DISPLAY tier —
 * a met floor or an in-limit ceiling. This is intentionally NOT the server's
 * `getNutrientStatus` bucket: a floor over 110% greens here (exceeding a
 * minimum is good), where `getNutrientStatus` would call it `above_target`.
 * Mirrors the Flutter NutrientGridCard's `statusKeyFor == onTarget`. An
 * exceeded ceiling is never "on target".
 */
function isOnTarget(card: NutrientCardData): boolean {
  const pct = card.percentOfTarget;
  if (pct === null) return false;
  const type = card.nutrientType;
  if (type === 'floor') return pct >= 90;
  if (type === 'ceiling') return pct >= 90 && pct <= 100;
  // range: within ±10% of target
  return Math.abs(pct - 100) <= 10;
}

/**
 * A compact nutrient cell for the 2-column grid: name + % on top, an inline
 * progress bar, then the absolute avg / goal below. Adequate nutrients green
 * the whole card; limited / no-target ones read muted. Mirrors the Flutter
 * NutrientGridCard.
 */
export function NutrientGridCard({
  card,
  barDelay = 0,
}: NutrientGridCardProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const locale = useLocale();

  const label = tRoot(card.labelKey);
  const pct = card.percentOfTarget;
  const isLimited =
    card.displayState === 'limited_data' ||
    card.displayState === 'insufficient_data';
  const showExceed = shouldShowExceed(card.nutrientType, pct);
  const adequate =
    pct !== null && !isLimited && !showExceed && isOnTarget(card);

  let figure: string;
  if (card.displayState === 'insufficient_data') {
    figure = t('steady.limited');
  } else if (pct === null) {
    figure = t('steady.noTarget');
  } else if (showExceed && pct > 100) {
    figure = `+${Math.round(pct - 100)}%`;
  } else {
    figure = t('steady.percent', { value: Math.round(pct) });
  }

  let goalText: string;
  if (card.target !== null) {
    const avg =
      card.averagePerDay !== null
        ? formatLocalizedNumber(card.averagePerDay, locale)
        : '0';
    goalText = `${avg} / ${formatLocalizedNumber(card.target, locale)} ${card.unit}`;
  } else if (card.averagePerDay !== null) {
    goalText = `${formatLocalizedNumber(card.averagePerDay, locale)} ${card.unit}`;
  } else {
    goalText = '—';
  }

  return (
    <div
      className={cn(
        'rounded-2xl border p-3',
        adequate
          ? 'border-nham-success-border bg-nham-success-faint'
          : 'border-nham-border/60 bg-card'
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[12px] text-nham-text">
          {label}
        </span>
        <span
          className={cn(
            'shrink-0 text-[12px] tabular-nums',
            showExceed
              ? 'text-nham-danger'
              : isLimited || pct === null
                ? 'text-nham-text-muted'
                : adequate
                  ? 'text-nham-success-dark'
                  : 'text-nham-text'
          )}
        >
          {figure}
        </span>
      </div>
      <div className="mt-2 flex">
        <TargetProgressBar
          percentOfTarget={pct}
          showExceed={showExceed}
          delay={barDelay}
          duration={0.6}
          ariaLabel={label}
          adequate={adequate}
        />
      </div>
      <p className="mt-2 truncate text-[12px] text-nham-text-muted tabular-nums">
        {goalText}
      </p>
    </div>
  );
}
