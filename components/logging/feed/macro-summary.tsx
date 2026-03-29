'use client';

import { Flame } from 'lucide-react';
import { motion } from 'motion/react';
import type { MacroBreakdown } from '@/lib/types/meal';
import { cn } from '@/lib/utils';

interface MacroSummaryProps {
  totals: MacroBreakdown;
}

export function MacroSummary({ totals }: MacroSummaryProps) {
  const { calories, protein, carbs, fat } = totals;

  if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-2.5',
        'border-[#E8D5B5] bg-[#FEFBF6]'
      )}
    >
      <div className="flex items-center gap-1.5">
        <Flame className="size-4 text-[#C9A87C]" />
        <span
          className="font-mono font-semibold text-[#2C2416] text-lg tabular-nums"
          style={{ fontFamily: 'Lora, serif' }}
        >
          {calories}
        </span>
        <span
          className="text-[#8B7355] text-xs"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          kcal
        </span>
      </div>

      <div className="h-4 w-px bg-[#E8D5B5]" aria-hidden="true" />

      <div className="flex items-center gap-1.5">
        {(
          [
            ['P', protein],
            ['C', carbs],
            ['F', fat],
          ] as const
        ).map(([label, value]) => (
          <span
            key={label}
            className={cn(
              'rounded border border-[#E8D5B5] bg-white px-1.5 py-0.5',
              'font-mono text-[#2C2416] text-xs tabular-nums'
            )}
          >
            <span
              className="text-[#8B7355]"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              {label}:
            </span>{' '}
            {value}g
          </span>
        ))}
      </div>
    </motion.div>
  );
}
