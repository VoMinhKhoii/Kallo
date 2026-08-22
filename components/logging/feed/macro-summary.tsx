'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { CalorieDial } from '@/components/shared/gauge/calorie-dial';
import {
  type MacroDialDatum,
  MacroDials,
} from '@/components/shared/gauge/macro-dials';
import type { MacroBreakdown } from '@/lib/core/types/meal';
import type { Goal } from '@/lib/domain/onboarding/types';

interface MacroSummaryProps {
  totals: MacroBreakdown;
  targets: MacroBreakdown;
  /** Which direction the user counts — the dial's headline follows it. */
  goal: Goal | null;
}

/**
 * The feed's header: the day's calorie dial and the three macro dials beside
 * it.
 *
 * The dock gives the dial the top of the screen; this header sits FIXED above a
 * scrolling day, so it draws the compact variants — the same marks, the same
 * goal-aware readout, at a height the feed can afford.
 */
export function MacroSummary({ totals, targets, goal }: MacroSummaryProps) {
  const t = useTranslations('dashboard');
  const macros: MacroDialDatum[] = [
    {
      key: 'protein',
      label: t('protein'),
      current: totals.protein,
      target: targets.protein,
    },
    {
      key: 'carbohydrate',
      label: t('carbs'),
      current: totals.carbs,
      target: targets.carbs,
    },
    { key: 'fat', label: t('fat'), current: totals.fat, target: targets.fat },
  ];

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      // The dials hold their size, so on a viewport too narrow for the row the
      // macros wrap under the day rather than shrinking toward illegible.
      className="flex flex-wrap items-start justify-center gap-x-4 gap-y-3 sm:justify-start"
      initial={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <CalorieDial
        goal={goal}
        logged={totals.calories}
        target={targets.calories}
        variant="compact"
      />
      <div className="min-w-[200px] flex-1">
        <MacroDials macros={macros} variant="compact" />
      </div>
    </motion.div>
  );
}
