'use client';

import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import type { MacroPattern, NutritionDaySeries } from '@/lib/nutrition/types';
import { cn } from '@/lib/utils';
import { DayStrip } from '../primitives/day-strip';
import { formatLocalizedNumber, shouldShowExceed } from '../primitives/helpers';
import { TargetProgressBar } from '../primitives/target-progress-bar';

interface DailyRhythmProps {
  macros: MacroPattern[];
  daySeries: NutritionDaySeries;
}

const KCAL_PER_GRAM = {
  protein: 4,
  carbohydrate: 4,
  fat: 9,
} as const;

const COMPOSITION_KEYS = ['protein', 'carbohydrate', 'fat'] as const;
type CompositionKey = (typeof COMPOSITION_KEYS)[number];

const COMPOSITION_COLORS: Record<CompositionKey, string> = {
  protein: 'var(--nham-macro-protein)',
  carbohydrate: 'var(--nham-macro-carbs)',
  fat: 'var(--nham-macro-fat)',
};

const COMPOSITION_SHORT: Record<CompositionKey, string> = {
  protein: 'P',
  carbohydrate: 'C',
  fat: 'F',
};

function consistencyLabelKey(pct: number | null): string {
  if (pct === null) return 'rhythm.consistency.noTarget';
  if (pct >= 80) return 'rhythm.consistency.steady';
  if (pct >= 55) return 'rhythm.consistency.rhythmic';
  if (pct >= 30) return 'rhythm.consistency.varies';
  return 'rhythm.consistency.thin';
}

export function DailyRhythm({ macros, daySeries }: DailyRhythmProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const locale = useLocale();

  const calories = macros.find((m) => m.key === 'calories');
  const caloriesSeries = daySeries.series.find((s) => s.metric === 'calories');
  const hasTimeAxis =
    caloriesSeries !== undefined &&
    caloriesSeries.buckets.some((bucket) => bucket.value !== null);
  const compositionLabels = Object.fromEntries(
    COMPOSITION_KEYS.map((key) => {
      const macro = macros.find((m) => m.key === key);
      return [key, macro ? tRoot(macro.labelKey) : COMPOSITION_SHORT[key]];
    })
  ) as Record<CompositionKey, string>;
  const composition = COMPOSITION_KEYS.map((key) => {
    const macro = macros.find((m) => m.key === key);
    if (!macro || macro.averagePerDay <= 0) {
      return { key, kcal: 0, grams: 0 };
    }
    return {
      key,
      kcal: macro.averagePerDay * KCAL_PER_GRAM[key],
      grams: macro.averagePerDay,
    };
  });
  const totalKcal = composition.reduce((sum, c) => sum + c.kcal, 0);
  const segments = composition.map((c) => ({
    key: c.key,
    pct: totalKcal > 0 ? (c.kcal / totalKcal) * 100 : 0,
  }));
  const orderedMacros = ['protein', 'carbohydrate', 'fat', 'fiber'] as const;
  const macroRows = orderedMacros
    .map((key) => macros.find((m) => m.key === key))
    .filter((m): m is MacroPattern => Boolean(m));

  const headingId = 'daily-rhythm-title';
  const eyebrowLabel = t('rhythm.eyebrow');

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      aria-labelledby={headingId}
      className="space-y-4"
    >
      <h2 id={headingId} className="sr-only">
        {eyebrowLabel}
      </h2>

      <div className="rounded-3xl border border-nham-border/60 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p
              className="font-serif text-nham-text leading-none tracking-[-0.02em]"
              style={{ fontWeight: 400 }}
            >
              <span className="text-4xl tabular-nums sm:text-5xl">
                {calories
                  ? formatLocalizedNumber(calories.averagePerDay, locale)
                  : '—'}
              </span>
              <span className="ml-2 text-base text-nham-text-muted">
                {t('rhythm.calories')}
              </span>
            </p>
            <p className="mt-1 text-nham-text-muted text-xs uppercase tracking-[0.18em]">
              {t('rhythm.avgPerLoggedDay')}
            </p>
          </div>

          {totalKcal > 0 ? (
            <div className="min-w-[12rem] sm:max-w-[18rem] sm:flex-1">
              <CompositionPill
                segments={segments}
                ariaLabel={t('rhythm.macroCompositionAria')}
              />
              {/* Composition legend: full words, with a 2px color tick UNDER
                  each word rather than a decorative dot before it (the bible's
                  tiny-dot disease). The tick keys word → bar color. */}
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-nham-text-muted tabular-nums">
                {segments.map((segment) => (
                  <span
                    key={segment.key}
                    className="inline-flex flex-col gap-1"
                  >
                    <span>
                      {compositionLabels[segment.key]} {Math.round(segment.pct)}
                      %
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-0.5 w-full rounded-full"
                      style={{
                        backgroundColor: COMPOSITION_COLORS[segment.key],
                      }}
                    />
                  </span>
                ))}
              </p>
            </div>
          ) : null}
        </div>

        {hasTimeAxis ? (
          <div className="mt-6 space-y-2 border-nham-border/40 border-t border-dashed pt-5">
            <p className="text-nham-text-muted text-xs uppercase tracking-[0.18em]">
              {daySeries.unit === 'day'
                ? t('rhythm.timeAxis.byDay')
                : t('rhythm.timeAxis.byWeek')}
            </p>
            <DayStrip
              series={caloriesSeries}
              unit={daySeries.unit}
              label={t('rhythm.calories')}
            />
          </div>
        ) : null}

        <div className="mt-6 space-y-3 border-nham-border/40 border-t border-dashed pt-5">
          {macroRows.map((macro) => (
            <MacroRow
              key={macro.key}
              macro={macro}
              locale={locale}
              label={tRoot(macro.labelKey)}
              consistencyLabel={t(consistencyLabelKey(macro.consistencyPct))}
              rowAriaLabel={t('rhythm.rowLabel', {
                macro: tRoot(macro.labelKey),
                average: formatLocalizedNumber(macro.averagePerDay, locale),
                unit: macro.unit,
                label: t(consistencyLabelKey(macro.consistencyPct)),
              })}
              barAriaLabel={t('rhythm.barAria', {
                macro: tRoot(macro.labelKey),
              })}
            />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

interface CompositionPillProps {
  segments: { key: CompositionKey; pct: number }[];
  ariaLabel: string;
}

function CompositionPill({ segments, ariaLabel }: CompositionPillProps) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="flex h-2 w-full overflow-hidden rounded-full bg-nham-track"
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
  );
}

interface MacroRowProps {
  macro: MacroPattern;
  locale: string;
  label: string;
  consistencyLabel: string;
  rowAriaLabel: string;
  barAriaLabel: string;
}

function MacroRow({
  macro,
  locale,
  label,
  consistencyLabel,
  rowAriaLabel,
  barAriaLabel,
}: MacroRowProps) {
  const ratio =
    macro.target && macro.target > 0
      ? macro.averagePerDay / macro.target
      : null;
  const pctOfTarget = ratio === null ? null : ratio * 100;
  const showExceed = shouldShowExceed(macro.nutrientType, pctOfTarget);

  let figure: string;
  if (macro.target === null || macro.target <= 0) {
    figure = `${formatLocalizedNumber(macro.averagePerDay, locale)} ${macro.unit}`;
  } else {
    const pct = Math.round((macro.averagePerDay / macro.target) * 100);
    figure = showExceed && pct > 100 ? `+${pct - 100}%` : `${pct}%`;
  }

  return (
    <div
      role="group"
      aria-label={rowAriaLabel}
      className="grid grid-cols-[5.5rem_1fr_auto_5.5rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[6.5rem_1fr_auto_6.5rem]"
    >
      <span
        className="truncate font-medium text-nham-text text-sm"
        title={label}
      >
        {label}
      </span>
      <TargetProgressBar
        percentOfTarget={pctOfTarget}
        showExceed={showExceed}
        duration={0.6}
        ariaLabel={barAriaLabel}
      />
      <span className="shrink-0 text-[11px] text-nham-text-muted tabular-nums">
        {macro.target === null
          ? ''
          : `${formatLocalizedNumber(macro.target, locale)} ${macro.unit}`}
      </span>
      <span className="text-right text-nham-text-muted text-xs">
        <span className="text-nham-text">{consistencyLabel}</span>
        <span
          className={cn(
            'ml-2 text-[11px] tabular-nums',
            showExceed ? 'text-nham-danger' : ''
          )}
        >
          {figure}
        </span>
      </span>
    </div>
  );
}
