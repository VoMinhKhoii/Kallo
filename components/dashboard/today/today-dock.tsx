'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { CalorieDial } from '@/components/shared/gauge/calorie-dial';
import { MacroDials } from '@/components/shared/gauge/macro-dials';
import type { MealEntry, NutritionData } from '@/lib/core/types/dashboard';
import { cn } from '@/lib/core/ui/cn';
import type { Goal } from '@/lib/domain/onboarding/types';
import { MealList } from './meal-list';

interface TodayDockProps {
  nutrition: NutritionData;
  meals: MealEntry[];
  /** Which direction the user counts — the dial's headline follows it. */
  goal: Goal | null;
  /** True while the input bar is streaming an analysis — the card leans in. */
  isStreaming?: boolean;
}

export function TodayDock({
  nutrition,
  meals,
  goal,
  isStreaming = false,
}: TodayDockProps) {
  const t = useTranslations('dashboard');

  // The day as one family of round marks: the calorie dial, then the same arc a
  // third of the size in each macro's pigment. Nothing here is carded except
  // the meals, so the zones are separated by a rhythm of whitespace — the
  // Flutter dock's label 8 / block 20 / majorBreak 40 — rather than by nested
  // fills. Stacks on mobile; on wide screens the meal list moves beside the
  // dials so the short dashboard row stays legible.
  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      aria-label={t('today')}
      className={cn(
        'flex min-h-0 flex-col gap-4 rounded-2xl border border-kallo-border/60 bg-card p-4 shadow-kallo-text/[0.03] shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-kallo-accent/50 hover:shadow-kallo-text/[0.06] hover:shadow-md xl:grid xl:h-full xl:grid-cols-[minmax(0,1fr)_minmax(240px,0.44fr)] xl:gap-5',
        isStreaming && 'border-kallo-accent/60'
      )}
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.45 }}
    >
      <div className="flex min-w-0 flex-col items-center justify-center">
        <CalorieDial
          goal={goal}
          logged={nutrition.calories.current}
          target={nutrition.calories.target}
        />
        {/* 20px: the dials qualify the figure above them, so they sit closer
            than the 40px break that separates today's numbers from the meals
            behind them. */}
        <div className="mt-5 w-full">
          <MacroDials
            current={{
              protein: nutrition.protein.current,
              carbohydrate: nutrition.carbs.current,
              fat: nutrition.fat.current,
            }}
            target={{
              protein: nutrition.protein.target,
              carbohydrate: nutrition.carbs.target,
              fat: nutrition.fat.target,
            }}
          />
        </div>
      </div>

      {/* The meals behind those numbers. A hairline separates them: horizontal
          when stacked, vertical when the list sits beside the dials. */}
      <div className="min-h-0 border-kallo-border/50 border-t pt-4 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-5">
        <MealList meals={meals} />
      </div>
    </motion.section>
  );
}
