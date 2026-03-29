'use client';

import { motion } from 'motion/react';
import type { MacroBreakdown } from '@/lib/types/meal';

interface MacroSummaryProps {
  totals: MacroBreakdown;
  targets: MacroBreakdown;
}

const RING_RADIUS = 42;
const RING_STROKE = 2.5;
const RING_SIZE = (RING_RADIUS + RING_STROKE) * 2;
const RING_CENTER = RING_SIZE / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const MACROS: {
  key: 'protein' | 'carbs' | 'fat';
  label: string;
  color: string;
}[] = [
  { key: 'protein', label: 'Protein', color: 'var(--nham-macro-protein)' },
  { key: 'carbs', label: 'Carbs', color: 'var(--nham-macro-carbs)' },
  { key: 'fat', label: 'Fat', color: 'var(--nham-macro-fat)' },
];

export function MacroSummary({ totals, targets }: MacroSummaryProps) {
  const { calories, protein, carbs, fat } = totals;

  if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) {
    return null;
  }

  const remaining = Math.max(0, targets.calories - calories);
  const calPercent =
    targets.calories > 0
      ? Math.max(0, Math.min(100, (calories / targets.calories) * 100))
      : 0;
  const dashOffset =
    RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * calPercent) / 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex items-center gap-6"
    >
      {/* Circular calorie progress */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <div
          className="relative"
          style={{ width: RING_SIZE, height: RING_SIZE }}
        >
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            aria-label={`${remaining} calories remaining of ${targets.calories}`}
          >
            <circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              fill="none"
              stroke="var(--nham-track)"
              strokeWidth={RING_STROKE}
            />
            <motion.circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              fill="none"
              stroke="var(--nham-text)"
              strokeWidth={RING_STROKE}
              strokeDasharray={RING_CIRCUMFERENCE}
              initial={{ strokeDashoffset: RING_CIRCUMFERENCE }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 1, ease: 'easeOut' }}
              strokeLinecap="round"
              transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="font-semibold text-nham-text text-xl tabular-nums leading-none"
              style={{ fontFamily: 'Lora, serif' }}
            >
              {remaining.toLocaleString()}
            </span>
            <span
              className="mt-0.5 font-bold text-[7px] text-nham-text-muted/60 uppercase tracking-widest"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              remaining
            </span>
          </div>
        </div>
        <span
          className="font-semibold text-nham-text-muted text-xs tabular-nums"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {calories} / {targets.calories.toLocaleString()} kcal
        </span>
      </div>

      {/* Divider */}
      <div className="h-12 w-px bg-nham-border/30" aria-hidden="true" />

      {/* Macro progress bars */}
      <div className="flex flex-1 flex-col gap-3">
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
                className="w-14 font-bold text-[10px] text-nham-text-muted/70 uppercase tracking-wider"
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
                className="w-16 text-right text-[11px] text-nham-text-muted tabular-nums"
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
