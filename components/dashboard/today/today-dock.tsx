'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { GaugeStrip } from '@/components/shared/gauge/gauge-strip';
import type { MealEntry, NutritionData } from '@/lib/core/types/dashboard';
import { cn } from '@/lib/core/ui/cn';
import { DOCK_MACRO_CAP } from '@/lib/core/ui/gauge-strip-layout';
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
  const current = {
    protein: nutrition.protein.current,
    carbohydrate: nutrition.carbs.current,
    fat: nutrition.fat.current,
  };
  const target = {
    protein: nutrition.protein.target,
    carbohydrate: nutrition.carbs.target,
    fat: nutrition.fat.target,
  };

  // The day as one family of round marks beside the meals behind them. ONE
  // composition at every width: the card used to draw a stacked full-size
  // cluster below 1280 and a compact side-by-side one above it — different
  // sizes, a different ratio between them and a different layout for the same
  // information, so the dock never settled into a shape. Now only the CONTAINER
  // changes at the breakpoint; the strip sizes its own marks from the column it
  // lands in.
  //
  // The gauge column is deliberately bounded at 44%: four arcs cannot fill a
  // 1300px card without becoming enormous, so the width is better spent on the
  // meal rows, whose macro figures were crowded into a 360px side column.
  // A percentage rather than an `fr` pair, because the share is the point and
  // the strip measures whatever it lands in.
  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      aria-label={t('today')}
      className={cn(
        'flex min-h-0 flex-col gap-4 rounded-2xl border border-kallo-border/60 bg-card p-4 shadow-kallo-text/[0.03] shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-kallo-accent/50 hover:shadow-kallo-text/[0.06] hover:shadow-md xl:grid xl:h-full xl:grid-cols-[44%_minmax(0,1fr)] xl:gap-5 xl:overflow-hidden',
        isStreaming && 'border-kallo-accent/60'
      )}
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.45 }}
    >
      <div
        className="flex min-w-0 items-center justify-center"
        data-testid="gauge-layout"
      >
        <GaugeStrip
          calories={{
            current: nutrition.calories.current,
            target: nutrition.calories.target,
          }}
          current={current}
          goal={goal}
          macroCap={DOCK_MACRO_CAP}
          target={target}
        />
      </div>

      {/* The meals behind those numbers. A hairline separates them: horizontal
          when stacked, vertical when the list sits beside the dials. */}
      <div className="min-h-0 border-kallo-border/50 border-t pt-4 xl:overflow-hidden xl:border-t-0 xl:border-l xl:pt-0 xl:pl-5">
        <MealList meals={meals} />
      </div>
    </motion.section>
  );
}
