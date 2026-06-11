'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { CalorieRing } from '@/components/shared/calorie-ring';
import type { MacroBreakdown } from '@/lib/types/meal';
import { cn } from '@/lib/utils';

interface MacroSummaryProps {
  totals: MacroBreakdown;
  targets: MacroBreakdown;
  /**
   * Past days are framed by what was eaten, not what's "left" — the day's
   * standing is carried by the heatmap color scale, not a remaining-count.
   */
  isPastDay?: boolean;
}

const MACRO_COLORS: Record<'protein' | 'carbs' | 'fat', string> = {
  protein: 'var(--nham-macro-protein)',
  carbs: 'var(--nham-macro-carbs)',
  fat: 'var(--nham-macro-fat)',
};

export function MacroSummary({
  totals,
  targets,
  isPastDay = false,
}: MacroSummaryProps) {
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
  const remaining = targets.calories - calories;
  const isOver = remaining < 0;

  // The ring center carries the day's standing through the number + a one-word
  // eyebrow — never a pill, an icon, or a colored verdict. Past days drop the
  // remaining/over framing entirely and simply show what was eaten.
  const centerValue = isPastDay ? calories : isOver ? -remaining : remaining;
  const centerLabel = isPastDay
    ? tRing('eaten')
    : isOver
      ? tRing('over')
      : tRing('left');

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
                {centerValue.toLocaleString()}
              </span>
              <span
                className={cn(
                  'mt-0.5 font-bold text-[8px] uppercase tracking-[0.15em]',
                  // Over target reads in espresso ink — present, not alarmed.
                  isOver && !isPastDay ? 'text-nham-text' : 'text-nham-stone'
                )}
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              >
                {centerLabel}
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
          const macroOver = target > 0 && current > target;
          // Under target: the fill is the consumed share of the bar, rest track.
          // Over target: the bar is full and splits — the macro colour holds the
          // target portion, the overflow trails in quiet terracotta. The bar
          // visibly spills past its goal; no icon, no pill, no alarm red.
          const fillPercent =
            target > 0
              ? Math.max(0, Math.min(100, (current / target) * 100))
              : 0;
          const targetPortion = macroOver ? (target / current) * 100 : 100;

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
                  animate={{ width: macroOver ? '100%' : `${fillPercent}%` }}
                  transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
                  className="flex h-full overflow-hidden rounded-full"
                >
                  {macroOver ? (
                    <>
                      <span
                        className="h-full shrink-0"
                        style={{
                          width: `${targetPortion}%`,
                          backgroundColor: color,
                        }}
                      />
                      <span
                        className="h-full flex-1"
                        style={{
                          backgroundColor: 'var(--nham-danger)',
                          opacity: 0.4,
                        }}
                      />
                    </>
                  ) : (
                    <span
                      className="h-full w-full"
                      style={{ backgroundColor: color }}
                    />
                  )}
                </motion.div>
              </div>
              <span
                className={cn(
                  'w-14 text-right text-[11px] tabular-nums sm:w-16',
                  macroOver ? 'text-nham-text' : 'text-nham-text-muted'
                )}
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
