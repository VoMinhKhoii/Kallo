'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

interface CalorieRingProps {
  current: number;
  target: number;
  size?: number;
  strokeWidth?: number;
  center?: ReactNode;
}

export function CalorieRing({
  current,
  target,
  size = 110,
  strokeWidth = 7,
  center,
}: CalorieRingProps) {
  const t = useTranslations('shared.calorieRing');
  const remaining = Math.max(0, target - current);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = target > 0 ? Math.min(remaining / target, 1) : 0;
  const dashOffset = circumference * (1 - pct);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        aria-label={t('ariaLabel', {
          remaining: remaining.toLocaleString(),
          target: target.toLocaleString(),
        })}
      >
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="text-nham-track"
          stroke="currentColor"
        />
        <motion.circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--nham-accent)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {center ?? (
          <>
            <span
              className="font-semibold text-[22px] text-nham-text tabular-nums leading-none"
              style={{ fontFamily: 'Lora, serif' }}
            >
              {remaining.toLocaleString()}
            </span>
            <span className="mt-0.5 font-bold text-[8px] text-nham-stone uppercase tracking-[0.15em]">
              {t('left')}
            </span>
            <span className="mt-0.5 text-[9px] text-nham-text-muted tabular-nums">
              / {target.toLocaleString()}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
