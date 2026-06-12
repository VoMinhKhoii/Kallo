'use client';

import { Flame } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { CalorieRing } from '@/components/shared/calorie-ring';
import { MacroBars } from '@/components/shared/macro-bars';
import type { MealEntry, NutritionData } from '@/lib/types/dashboard';
import { MealList } from './meal-list';
import { InlineMealTrigger } from './meal-trigger';

interface WeeklyAccumulator {
  consumed: number;
  target: number;
  hasData: boolean;
}

interface TodayDockProps {
  nutrition: NutritionData;
  meals: MealEntry[];
  weekly?: WeeklyAccumulator;
  /** True before the user has ever logged a meal — show the day-0 prompt. */
  isFirstRun?: boolean;
}

export function TodayDock({
  nutrition,
  meals,
  weekly,
  isFirstRun,
}: TodayDockProps) {
  const t = useTranslations('dashboard');
  // Over target is shown, not censored: the honest over-count with an eyebrow
  // that flips to "Over target" in espresso ink — never a clamped 0, never red.
  const remaining = nutrition.calories.target - nutrition.calories.current;
  const isOver = remaining < 0;
  const macroItems = [
    {
      label: t('protein'),
      current: nutrition.protein.current,
      target: nutrition.protein.target,
      color: 'var(--nham-macro-protein)',
      unit: 'g' as const,
    },
    {
      label: t('carbs'),
      current: nutrition.carbs.current,
      target: nutrition.carbs.target,
      color: 'var(--nham-macro-carbs)',
      unit: 'g' as const,
    },
    {
      label: t('fat'),
      current: nutrition.fat.current,
      target: nutrition.fat.target,
      color: 'var(--nham-macro-fat)',
      unit: 'g' as const,
    },
  ];

  // Day 0: the user has never logged. Don't open with a full ring reading
  // "2,000 remaining" computed from silent defaults — that's a verdict over no
  // data. A single Lora question and the composer is the whole card.
  if (isFirstRun && meals.length === 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex flex-col items-center gap-6 rounded-[1.5rem] border border-nham-border/70 bg-card px-4 py-12 text-center shadow-[0_10px_32px_rgba(44,36,22,0.05)] sm:px-5 sm:py-16"
        aria-label={t('today')}
      >
        <p
          className="max-w-sm text-3xl text-nham-text leading-tight tracking-[-0.02em] sm:text-4xl"
          style={{ fontFamily: 'Lora, serif', fontWeight: 400 }}
        >
          {t('firstRunPrompt')}
        </p>
        <div className="w-full max-w-md">
          <InlineMealTrigger />
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="flex flex-col gap-4 rounded-[1.5rem] border border-nham-border/70 bg-card p-4 shadow-[0_10px_32px_rgba(44,36,22,0.05)] sm:p-5"
      aria-label={t('today')}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.62fr)_minmax(260px,0.38fr)]">
        <div className="grid gap-4 sm:grid-cols-[minmax(200px,0.42fr)_minmax(0,0.58fr)]">
          <div className="flex flex-col justify-center rounded-[1.25rem] bg-nham-surface p-4">
            <span
              className={`block font-bold text-[10px] uppercase tracking-[0.2em] ${
                isOver ? 'text-nham-text' : 'text-nham-stone'
              }`}
            >
              {isOver ? t('overTarget') : t('caloriesRemaining')}
            </span>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className="font-light text-[56px] text-nham-text tabular-nums leading-none tracking-[-0.04em] sm:text-[64px]"
                style={{ fontFamily: 'Lora, serif' }}
              >
                {Math.abs(remaining).toLocaleString()}
              </span>
              <span
                className="text-nham-text-muted text-xl italic"
                style={{ fontFamily: 'Lora, serif' }}
              >
                / {nutrition.calories.target.toLocaleString()}
              </span>
            </div>
            <p className="mt-1.5 text-nham-stone text-xs">
              {nutrition.calories.current.toLocaleString()}{' '}
              {t('caloriesLogged')}
            </p>
            {weekly?.hasData && (
              <p className="mt-0.5 text-nham-stone text-xs">
                {t('weeklyAccumulator', {
                  consumed: weekly.consumed.toLocaleString(),
                  target: weekly.target.toLocaleString(),
                })}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-[1.25rem] bg-nham-surface p-4">
            <CalorieRing
              current={nutrition.calories.current}
              target={nutrition.calories.target}
              size={72}
              strokeWidth={6}
              center={<Flame className="h-6 w-6 text-nham-accent" />}
            />
            <MacroBars items={macroItems} />
          </div>
        </div>

        <div className="min-h-[140px] rounded-[1.25rem] border border-nham-border/60 bg-nham-surface/60 p-3">
          <MealList meals={meals} />
        </div>
      </div>

      {/* Composer as the band's full-width bottom row — present at EVERY
          breakpoint (previously xl-only, so it vanished 768–1280px). The mobile
          floating trigger still covers <768 with its own affordance, so this is
          shown from sm up to avoid two composers on phones. */}
      <div className="hidden min-w-0 sm:block">
        <InlineMealTrigger />
      </div>
    </motion.section>
  );
}
