'use client';

import { motion } from 'motion/react';

export interface MacroItem {
  label: string;
  current: number;
  target: number;
  color: string;
  unit?: string;
}

interface MacroBarsProps {
  items: MacroItem[];
}

export function MacroBars({ items }: MacroBarsProps) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-3.5">
      {items.map(({ label, current, target, color, unit = 'g' }, idx) => {
        const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
        return (
          <div key={label} className="flex items-center gap-3">
            <span className="w-12 font-bold text-[9px] text-nham-stone uppercase tracking-widest">
              {label}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-nham-track">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{
                  duration: 0.9,
                  delay: idx * 0.1 + 0.2,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
            </div>
            <span className="w-[52px] text-right font-mono text-[10px] text-nham-stone tabular-nums">
              {Math.round(current)}/{target}
              {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}
