'use client';

import { motion } from 'motion/react';
import { GaugeStrip } from '@/components/shared/gauge/gauge-strip';
import type { MacroBreakdown } from '@/lib/core/types/meal';
import { FEED_MACRO_CAP } from '@/lib/core/ui/gauge-strip-layout';
import type { Goal } from '@/lib/domain/onboarding/types';

interface MacroSummaryProps {
  totals: MacroBreakdown;
  targets: MacroBreakdown;
  /** Which direction the user counts — the dial's headline follows it. */
  goal: Goal | null;
}

/**
 * The feed's header: the day's four marks in one row.
 *
 * The dock gives the strip a card to fill; this header sits FIXED above a
 * scrolling day, so it caps its marks small — every pixel here is a pixel the
 * feed does not get. `FEED_MACRO_CAP` is the smallest cap at which the calorie
 * dial still has room for the sentence the dock's says, so the two pages
 * answer "how am I doing today?" the same way.
 */
export function MacroSummary({ totals, targets, goal }: MacroSummaryProps) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <GaugeStrip
        calories={{ current: totals.calories, target: targets.calories }}
        current={{
          protein: totals.protein,
          carbohydrate: totals.carbs,
          fat: totals.fat,
        }}
        goal={goal}
        macroCap={FEED_MACRO_CAP}
        target={{
          protein: targets.protein,
          carbohydrate: targets.carbs,
          fat: targets.fat,
        }}
      />
    </motion.div>
  );
}
