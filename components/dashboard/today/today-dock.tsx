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
}

export function TodayDock({ nutrition, meals, weekly }: TodayDockProps) {
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

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="grid gap-3 rounded-[1.5rem] border border-nham-border/70 bg-card/90 p-3 shadow-[0_10px_32px_rgba(44,36,22,0.05)] xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,0.68fr)_minmax(260px,0.32fr)] xl:p-4"
      aria-label={t('today')}
    >
      <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(180px,0.34fr)_minmax(0,0.66fr)]">
        <div className="flex min-h-0 flex-col justify-center rounded-[1.25rem] bg-nham-surface/80 p-3">
          <span
            className={`block font-bold text-[10px] uppercase tracking-[0.2em] ${
              isOver ? 'text-nham-text' : 'text-nham-stone'
            }`}
          >
            {isOver ? t('overTarget') : t('caloriesRemaining')}
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className="font-normal text-4xl text-nham-text tabular-nums leading-none tracking-[-0.04em] sm:text-5xl"
              style={{ fontFamily: 'Lora, serif' }}
            >
              {Math.abs(remaining).toLocaleString()}
            </span>
            <span
              className="text-lg text-nham-text-muted italic"
              style={{ fontFamily: 'Lora, serif' }}
            >
              / {nutrition.calories.target.toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-nham-stone text-xs">
            {nutrition.calories.current.toLocaleString()} {t('caloriesLogged')}
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

        <div className="grid min-h-0 gap-3 xl:grid-rows-[minmax(0,1fr)_auto]">
          <div className="flex min-h-0 items-center gap-3 rounded-[1.25rem] bg-nham-surface/60 p-3">
            <CalorieRing
              current={nutrition.calories.current}
              target={nutrition.calories.target}
              size={72}
              strokeWidth={6}
              center={<Flame className="h-6 w-6 text-nham-accent" />}
            />
            <MacroBars items={macroItems} />
          </div>
          <div className="hidden min-w-0 xl:block">
            <InlineMealTrigger />
          </div>
        </div>
      </div>

      <div className="min-h-[140px] rounded-[1.25rem] border border-nham-border/60 bg-nham-surface/60 p-2.5 xl:min-h-0">
        <MealList meals={meals} />
      </div>
    </motion.section>
  );
}
