'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { CalorieRing } from '@/components/shared/calorie-ring';
import type { MacroBreakdown } from '@/lib/types/meal';

interface MacroSummaryProps {
  totals: MacroBreakdown;
  targets: MacroBreakdown;
}

const MACRO_COLORS: Record<'protein' | 'carbs' | 'fat', string> = {
  protein: 'var(--nham-macro-protein)',
  carbs: 'var(--nham-macro-carbs)',
  fat: 'var(--nham-macro-fat)',
};

export function MacroSummary({ totals, targets }: MacroSummaryProps) {
  const td = useTranslations('dashboard');
  const tRing = useTranslations('shared.calorieRing');

  const MACROS: {
    key: 'protein' | 'carbs' | 'fat';
    label: string;
    color: string;
  }[] = [
    { key: 'protein', label: td('protein'), color: MACRO_COLORS.protein },
    { key: 'carbs', label: td('carbs'), color: MACRO_COLORS.carbs },
    { key: 'fat', label: td('fat'), color: MACRO_COLORS.fat },
  ];
  const { calories } = totals;
  const remaining = Math.max(0, targets.calories - calories);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex items-center gap-4 sm:gap-6"
    >
      {/* Circular calorie progress */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <CalorieRing
          current={calories}
          target={targets.calories}
          // Size + stroke driven by CSS media queries (no JS hook, no
          // hydration flash). Stroke value reaches CalorieRing via the
          // `--calorie-ring-stroke` CSS variable.
          className="size-[78px] [--calorie-ring-stroke:3px] sm:size-[86px] sm:[--calorie-ring-stroke:4px]"
          center={
            <>
              <span
                className="font-normal text-[17px] text-nham-text tabular-nums leading-none sm:text-[19px]"
                style={{ fontFamily: 'Lora, serif' }}
              >
                {remaining.toLocaleString()}
              </span>
              <span
                className="mt-0.5 font-bold text-[8px] text-nham-stone uppercase tracking-[0.15em]"
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              >
                {tRing('left')}
              </span>
            </>
          }
        />
        <span
          className="font-semibold text-nham-text-muted text-xs tabular-nums"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {calories.toLocaleString()} / {targets.calories.toLocaleString()} kcal
        </span>
      </div>

      {/* Divider */}
      <div
        className="hidden h-12 w-px bg-nham-border/30 sm:block"
        aria-hidden="true"
      />

      {/* Macro progress bars */}
      <div className="flex flex-1 flex-col gap-2 sm:gap-3">
        {MACROS.map(({ key, label, color }) => {
          const current = totals[key];
          const target = targets[key];
          const percent =
            target > 0
              ? Math.max(0, Math.min(100, (current / target) * 100))
              : 0;

          return (
            <div key={key} className="flex items-center gap-3">
              <span
                className="w-12 font-bold text-[10px] text-nham-text-muted/70 uppercase tracking-wider sm:w-14"
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              >
                {label}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-nham-track">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{
                    duration: 1,
                    delay: 0.2,
                    ease: 'easeOut',
                  }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                />
              </div>
              <span
                className="w-14 text-right text-[11px] text-nham-text-muted tabular-nums sm:w-16"
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              >
                {Math.round(current)}/{target}g
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
