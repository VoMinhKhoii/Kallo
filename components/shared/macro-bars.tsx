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
    <div className="flex flex-col gap-2.5">
      {items.map(({ label, current, target, color, unit = 'g' }, idx) => {
        const pct =
          target > 0 ? Math.max(0, Math.min((current / target) * 100, 100)) : 0;
        return (
          <div key={label} className="flex items-center gap-3">
            <span className="w-16 font-medium text-[11px] text-nham-text uppercase tracking-[0.08em]">
              {label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-nham-track">
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
            <span className="w-[68px] text-right text-[12px] text-nham-text tabular-nums">
              {Math.round(current)}/{target}
              {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}
