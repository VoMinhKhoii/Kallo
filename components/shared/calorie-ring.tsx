'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CalorieRingProps {
  current: number;
  target: number;
  /**
   * Render size in CSS pixels. Optional — when omitted, the consumer is
   * expected to size the wrapper via `className` (e.g. responsive Tailwind
   * classes) so the size can change with media queries without a JS flash.
   */
  size?: number;
  /**
   * Stroke width in CSS pixels. Optional — when omitted, falls back to the
   * `--calorie-ring-stroke` CSS variable (default 7px). Consumers can set
   * the var per breakpoint via Tailwind arbitrary properties.
   */
  strokeWidth?: number;
  center?: ReactNode;
  className?: string;
}

// The SVG is drawn in a normalized viewBox so size/stroke can be controlled
// from CSS without re-computing the geometry. `vector-effect: non-scaling-stroke`
// keeps the stroke at the requested CSS px width regardless of the SVG's
// rendered size, so a single declarative ring scales cleanly across breakpoints.
const VIEWBOX = 100;
const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = VIEWBOX / 2;

export function CalorieRing({
  current,
  target,
  size,
  strokeWidth,
  center,
  className,
}: CalorieRingProps) {
  const t = useTranslations('shared.calorieRing');
  const remaining = Math.max(0, target - current);
  const pct = target > 0 ? Math.min(remaining / target, 1) : 0;
  const dashOffset = CIRCUMFERENCE * (1 - pct);

  const wrapperStyle = size ? { width: size, height: size } : undefined;
  const strokeStyle = {
    strokeWidth: strokeWidth ?? 'var(--calorie-ring-stroke, 7px)',
  };

  return (
    <div className={cn('relative shrink-0', className)} style={wrapperStyle}>
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        width="100%"
        height="100%"
        overflow="visible"
        role="img"
        aria-label={t('ariaLabel', {
          remaining: remaining.toLocaleString(),
          target: target.toLocaleString(),
        })}
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          vectorEffect="non-scaling-stroke"
          className="text-nham-track"
          style={strokeStyle}
        />
        <motion.circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="var(--nham-accent)"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          vectorEffect="non-scaling-stroke"
          style={strokeStyle}
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
