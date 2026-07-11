'use client';

import { Flame } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { CalorieRing } from '@/components/shared/calorie-ring';
import { MacroBars } from '@/components/shared/macro-bars';
import type { MealEntry, NutritionData } from '@/lib/types/dashboard';
import { cn } from '@/lib/utils';
import { MealList } from './meal-list';

interface TodayDockProps {
  nutrition: NutritionData;
  meals: MealEntry[];
  /** True while the input bar is streaming an analysis — the card leans in. */
  isStreaming?: boolean;
}

export function TodayDock({
  nutrition,
  meals,
  isStreaming = false,
}: TodayDockProps) {
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
      className={cn(
        'flex min-h-0 flex-col gap-4 rounded-2xl border border-nham-border/60 bg-card p-4 shadow-nham-text/[0.03] shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-nham-accent/50 hover:shadow-md hover:shadow-nham-text/[0.06] xl:grid xl:h-full xl:grid-cols-[minmax(0,1fr)_minmax(240px,0.44fr)] xl:gap-5',
        isStreaming && 'border-nham-accent/60'
      )}
      aria-label={t('today')}
    >
      <div className="flex min-w-0 flex-col justify-center">
        {/* (a) Hero: calories-remaining number on the left, macro bars in the
            middle (md+), ring on the right. On narrow screens the bars drop
            below the hero instead. */}
        <div className="flex items-center gap-4 md:gap-6">
          <div className="min-w-0 shrink-0">
            <div className="flex items-baseline gap-1.5">
              <span className="font-sans-display text-hero text-nham-text tabular-nums">
                {remaining.toLocaleString()}
              </span>
              <span className="font-sans-display text-nham-text-muted text-sm">
                / {nutrition.calories.target.toLocaleString()}
              </span>
            </div>
            <p className="mt-1.5 text-nham-text-muted text-xs">
              {nutrition.calories.current.toLocaleString()}{' '}
              {t('caloriesLogged')}
            </p>
          </div>

          <div className="hidden min-w-0 flex-1 md:block">
            <MacroBars items={macroItems} />
          </div>

          <div className="ml-auto shrink-0 md:ml-0">
            <CalorieRing
              current={nutrition.calories.current}
              target={nutrition.calories.target}
              size={80}
              strokeWidth={5}
              center={
                <Flame
                  className={cn(
                    'h-6 w-6 text-nham-accent',
                    isStreaming && 'animate-pulse'
                  )}
                />
              }
            />
          </div>
        </div>

        {/* (b) Macro bars — full width under the hero on narrow screens. */}
        <div className="mt-4 md:hidden">
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
