'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import type {
  CalorieAverages,
  MacroPattern,
  NutritionDayScope,
  NutritionDaySeries,
  NutritionRange,
} from '@/lib/nutrition/types';
import { formatLocalizedNumber } from '../primitives/helpers';
import { CalorieScopeStats } from './calorie-scope-stats';
import { MacroTrendChart } from './macro-trend-chart';
import {
  buildMacroTrendData,
  COMPOSITION_COLORS,
  COMPOSITION_KEYS,
  COMPOSITION_SHORT,
  KCAL_PER_GRAM,
} from './macro-trend-utils';

interface DaySummaryProps {
  macros: MacroPattern[];
  daySeries: NutritionDaySeries;
  resolvedRange: NutritionRange;
  calorieAverages: CalorieAverages;
  scope: NutritionDayScope;
  onScopeChange: (scope: NutritionDayScope) => void;
}

/**
 * Compact calorie + macro summary — the Flutter DaySummary port. One solid card:
 * the swappable dual-scope calorie hero on the left with an over/under-vs-target
 * note (read from the active scope) on the right. Multi-day ranges with ≥2
 * buckets show a stacked macro-calorie trend
 * chart; a single day keeps the static P/C/F composition bar. A centered gram
 * legend sits below either.
 */
export function DaySummary({
  macros,
  daySeries,
  resolvedRange,
  calorieAverages,
  scope,
  onScopeChange,
}: DaySummaryProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const locale = useLocale();

  const calories = macros.find((m) => m.key === 'calories');
  const target = calories?.target ?? null;
  // Over/under-target badge reads from the ACTIVE scope's average.
  const activeAvg = calorieAverages[scope].averagePerDay;
  const diff =
    target !== null && target > 0 && activeAvg !== null
      ? activeAvg - target
      : null;
  const showNoCompleteDays =
    scope === 'complete' && calorieAverages.complete.averagePerDay === null;

  const composition = COMPOSITION_KEYS.map((key) => {
    const macro = macros.find((m) => m.key === key);
    const grams = macro && macro.averagePerDay > 0 ? macro.averagePerDay : 0;
    return {
      key,
      grams,
      kcal: grams * KCAL_PER_GRAM[key],
      label: macro ? tRoot(macro.labelKey) : COMPOSITION_SHORT[key],
    };
  });
  const totalKcal = composition.reduce((sum, c) => sum + c.kcal, 0);
  const segments = composition.map((c) => ({
    ...c,
    pct: totalKcal > 0 ? (c.kcal / totalKcal) * 100 : 0,
  }));

  // Multi-day ranges chart the macro-calorie trend; 1d has no trend to show.
  const trendData =
    resolvedRange !== '1d' ? buildMacroTrendData(daySeries) : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="rounded-[1.375rem] bg-card p-5 shadow-[0_10px_32px_rgba(44,36,22,0.05)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <CalorieScopeStats
            averages={calorieAverages}
            scope={scope}
            onScopeChange={onScopeChange}
          />
        </div>

        {diff !== null ? (
          <div className="flex shrink-0 items-center gap-1 pt-1 text-nham-text-muted">
            {diff >= 0 ? (
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="text-[12px] tabular-nums">
              {formatLocalizedNumber(Math.abs(diff), locale)}{' '}
              {t('rhythm.calories')}
            </span>
          </div>
        ) : null}
      </div>

      {showNoCompleteDays ? (
        <p className="mt-3 text-[12px] text-nham-text-muted">
          {t('rhythm.noCompleteDays')}
        </p>
      ) : null}

      {totalKcal > 0 ? (
        <>
          {trendData ? (
            <MacroTrendChart
              points={trendData.points}
              maxY={trendData.maxY}
              unit={daySeries.unit}
            />
          ) : (
            <div
              role="img"
              aria-label={t('rhythm.macroCompositionAria')}
              className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-nham-track"
            >
              {segments.map((segment) =>
                segment.pct > 0 ? (
                  <motion.span
                    key={segment.key}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
                    style={{
                      width: `${segment.pct}%`,
                      backgroundColor: COMPOSITION_COLORS[segment.key],
                      transformOrigin: 'left',
                    }}
                    className="h-full"
                  />
                ) : null
              )}
            </div>
          )}

          {/* Centered legend: a short color bar (not a dot) + label + avg grams. */}
          <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2">
            {segments.map((segment) => (
              <span
                key={segment.key}
                className="inline-flex items-center gap-1.5 text-[12px] text-nham-text tabular-nums"
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-4 rounded-full"
                  style={{ backgroundColor: COMPOSITION_COLORS[segment.key] }}
                />
                {segment.label} {formatLocalizedNumber(segment.grams, locale)}g
              </span>
            ))}
          </div>
        </>
      ) : null}
    </motion.section>
  );
}
