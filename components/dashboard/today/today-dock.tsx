'use client';

import { Flame } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { CalorieRing } from '@/components/shared/calorie-ring';
import { MacroBars } from '@/components/shared/macro-bars';
import type { MealEntry, NutritionData } from '@/lib/types/dashboard';
import { MealList } from './meal-list';

interface TodayDockProps {
  nutrition: NutritionData;
  meals: MealEntry[];
}

export function TodayDock({ nutrition, meals }: TodayDockProps) {
  const t = useTranslations('dashboard');
  const remaining = Math.max(
    0,
    nutrition.calories.target - nutrition.calories.current
  );
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

  // ONE flat solid card (the Flutter TodaySection redesign): calorie hero + ring,
  // macro bars, and a plain meal list. Zones are separated by whitespace and a
  // single hairline — not by nested tinted sub-panels. Stacks on mobile (like
  // Flutter); on wide screens the meal list moves beside the summary so the
  // short dashboard row stays legible.
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="flex min-h-0 flex-col gap-4 rounded-[1.375rem] bg-card p-4 shadow-[0_10px_32px_rgba(44,36,22,0.05)] xl:grid xl:h-full xl:grid-cols-[minmax(0,1fr)_minmax(240px,0.44fr)] xl:gap-5"
      aria-label={t('today')}
    >
      <div className="flex min-w-0 flex-col">
        {/* (a) Hero: calories-remaining number on the left, ring on the right. */}
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <span className="block font-medium text-[11px] text-nham-text-muted uppercase tracking-[0.08em]">
              {t('caloriesRemaining')}
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-medium font-sans-display text-4xl text-nham-text tabular-nums leading-none tracking-[-0.04em] sm:text-5xl">
                {remaining.toLocaleString()}
              </span>
              <span className="font-sans-display text-lg text-nham-text-muted">
                / {nutrition.calories.target.toLocaleString()}
              </span>
            </div>
            <p className="mt-1.5 text-nham-text-muted text-xs">
              {nutrition.calories.current.toLocaleString()}{' '}
              {t('caloriesLogged')}
            </p>
          </div>

          <CalorieRing
            current={nutrition.calories.current}
            target={nutrition.calories.target}
            size={80}
            strokeWidth={5}
            center={<Flame className="h-6 w-6 text-nham-accent" />}
          />
        </div>

        {/* (b) Macro bars — full width under the hero. */}
        <div className="mt-4">
          <MacroBars items={macroItems} />
        </div>
      </div>

      {/* (c) Meal list — plain, on the card surface (no nested fill). A hairline
          separates it from the summary: horizontal when stacked, vertical when
          the list sits beside the summary on wide screens. */}
      <div className="min-h-0 border-nham-border/50 border-t pt-4 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-5">
        <MealList meals={meals} />
      </div>
    </motion.section>
  );
}
