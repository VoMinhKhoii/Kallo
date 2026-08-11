'use client';

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
  COMPOSITION_ICONS,
  COMPOSITION_KEYS,
  KCAL_PER_GRAM,
} from './macro-trend-utils';

interface DaySummaryProps {
  macros: MacroPattern[];
  daySeries: NutritionDaySeries;
  resolvedRange: NutritionRange;
  calorieAverages: CalorieAverages;
  /** The same averages for the equal-length window before this one. */
  previousCalorieAverages: CalorieAverages;
  scope: NutritionDayScope;
  onScopeChange: (scope: NutritionDayScope) => void;
  /** The dates the figures cover — the range, or the tapped bucket. */
  dateSpan: string;
  /** Nothing logged in the range: one figure, no scope swap to choose between. */
  isEmpty: boolean;
  todayIndex: number;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

/**
 * Compact calorie + macro summary — the Flutter DaySummary port. One solid card:
 * the swappable dual-scope calorie hero on the left with an over/under-vs-target
 * note (read from the active scope) on the right. Multi-day ranges with ≥2
 * buckets show a stacked macro-calorie trend
 * chart; a single day keeps the static macro composition bar. A centered gram
 * legend sits below either.
 */
export function DaySummary({
  macros,
  daySeries,
  resolvedRange,
  calorieAverages,
  previousCalorieAverages,
  scope,
  onScopeChange,
  dateSpan,
  isEmpty,
  todayIndex,
  selectedIndex,
  onSelect,
}: DaySummaryProps) {
  const t = useTranslations('nutrition');
  const locale = useLocale();

  const calories = macros.find((m) => m.key === 'calories');
  const isSelected = selectedIndex !== null;
  const activeAvg = isSelected
    ? (calories?.averagePerDay ?? null)
    : calorieAverages[scope].averagePerDay;
  // How this window compares with the one before it, same length and same day
  // scope. Absent while a column is selected — one bucket has no "period
  // before" of its own — and absent when nothing was logged back then.
  const previousAvg = previousCalorieAverages[scope].averagePerDay;
  const diff =
    !isSelected && activeAvg !== null && previousAvg !== null
      ? activeAvg - previousAvg
      : null;
  const composition = COMPOSITION_KEYS.map((key) => {
    const macro = macros.find((m) => m.key === key);
    const grams = macro && macro.averagePerDay > 0 ? macro.averagePerDay : 0;
    return {
      key,
      grams,
      kcal: grams * KCAL_PER_GRAM[key],
      // The legend's own short names, not `macro.labelKey`: these sit beside a
      // number in a tight row, so they are clipped harder than the full names
      // the nutrient grid uses ("Pro" / "Đạm", not "Protein" / "Chất đạm").
      label: t(`macrosShort.${key}`),
    };
  });
  const totalKcal = composition.reduce((sum, c) => sum + c.kcal, 0);
  const segments = composition.map((c) => ({
    ...c,
    pct: totalKcal > 0 ? (c.kcal / totalKcal) * 100 : 0,
  }));

  // A selected column is that bucket, not an average over a day scope, so the
  // title drops the qualifier rather than claiming one.
  const title = isSelected
    ? t('cardTitle')
    : `${t('cardTitle')} · ${t(
        isEmpty || scope === 'all' ? 'rhythm.loggedDays' : 'rhythm.completeDays'
      )}`;

  // Multi-day ranges chart the macro-calorie trend; 1d has no trend to show.
  const trendData =
    resolvedRange !== '1d' ? buildMacroTrendData(daySeries) : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="flex flex-col gap-3"
    >
      {/* The card names the scope its figure is averaged over. The unit used to
          carry it ("kcal per complete day"); saying it once in the title keeps
          the figure clean without leaving the scope inferable only from a
          button that names the OTHER one. */}
      <h2 className="font-medium text-[11px] text-nham-text-muted uppercase tracking-[0.08em]">
        {title}
      </h2>
      <div className="rounded-[1.375rem] bg-card p-5 shadow-[0_10px_32px_rgba(44,36,22,0.05)]">
        <CalorieScopeStats
          averages={calorieAverages}
          scope={scope}
          onScopeChange={onScopeChange}
          dateSpan={dateSpan}
          selectedValue={isSelected ? activeAvg : undefined}
          isEmpty={isEmpty}
          diff={diff}
        />

        {trendData ? (
          <MacroTrendChart
            points={trendData.points}
            maxY={trendData.maxY}
            unit={daySeries.unit}
            todayIndex={todayIndex}
            selectedIndex={selectedIndex}
            onSelect={onSelect}
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

        {/* Centered legend: the macro's food icon in its band colour, then the
            label and average grams. The icon doubles as the colour key, so it
            carries the band it names rather than sitting beside an abstract
            swatch that has to be decoded.
            Centred on a fixed gap, where the Flutter mirror distributes the
            slack: this column is far wider than a phone's, so the three never
            crowd and spreading them would only strand them apart. */}
        <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2">
          {segments.map((segment) => {
            const Icon = COMPOSITION_ICONS[segment.key];
            return (
              <span
                key={segment.key}
                className="inline-flex items-center gap-1.5 text-[12px] text-nham-text tabular-nums"
              >
                <Icon
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: COMPOSITION_COLORS[segment.key] }}
                />
                {segment.label} {formatLocalizedNumber(segment.grams, locale)}g
              </span>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
