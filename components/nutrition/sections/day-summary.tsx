'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import type { MacroPattern } from '@/lib/nutrition/types';
import { formatLocalizedNumber } from '../primitives/helpers';

interface DaySummaryProps {
  macros: MacroPattern[];
}

const KCAL_PER_GRAM = { protein: 4, carbohydrate: 4, fat: 9 } as const;
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

/**
 * Compact calorie + macro summary — the Flutter DaySummary port. One solid card:
 * the average-calorie hero on the left with an over/under-vs-target note on the
 * right, then a P/C/F composition bar and a centered gram legend.
 */
export function DaySummary({ macros }: DaySummaryProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const locale = useLocale();

  const calories = macros.find((m) => m.key === 'calories');
  const avg = calories?.averagePerDay ?? 0;
  const target = calories?.target ?? null;
  const diff = target !== null && target > 0 ? avg - target : null;

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
    key: c.key,
    label: c.label,
    grams: c.grams,
    pct: totalKcal > 0 ? (c.kcal / totalKcal) * 100 : 0,
  }));

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="rounded-[1.375rem] bg-card p-5 shadow-[0_10px_32px_rgba(44,36,22,0.05)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-baseline gap-2 text-nham-text leading-none">
            <span className="font-medium font-sans-display text-4xl tabular-nums tracking-[-0.03em] sm:text-5xl">
              {avg > 0 ? formatLocalizedNumber(avg, locale) : '—'}
            </span>
            <span className="text-base text-nham-text-muted">
              {t('rhythm.calories')}
            </span>
          </p>
          <p className="mt-1.5 font-medium text-[11px] text-nham-text-muted uppercase tracking-[0.08em]">
            {t('rhythm.avgPerLoggedDay')}
          </p>
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

      {totalKcal > 0 ? (
        <>
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
