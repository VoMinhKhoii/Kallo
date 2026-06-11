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
        const isOver = target > 0 && current > target;
        const pct =
          target > 0 ? Math.max(0, Math.min((current / target) * 100, 100)) : 0;
        // Over target the bar fills and spills: the macro colour holds the
        // target share, the overflow trails in quiet terracotta. No alarm.
        const targetPortion = isOver ? (target / current) * 100 : 100;
        return (
          <div key={label} className="flex items-center gap-3">
            <span className="w-12 font-bold text-[9px] text-nham-stone uppercase tracking-widest">
              {label}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-nham-track">
              <motion.div
                className="flex h-full overflow-hidden rounded-full"
                initial={{ width: 0 }}
                animate={{ width: isOver ? '100%' : `${pct}%` }}
                transition={{
                  duration: 0.9,
                  delay: idx * 0.1 + 0.2,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {isOver ? (
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
              className={`w-[52px] text-right font-mono text-[10px] tabular-nums ${
                isOver ? 'text-nham-text' : 'text-nham-stone'
              }`}
            >
              {Math.round(current)}/{target}
              {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}
