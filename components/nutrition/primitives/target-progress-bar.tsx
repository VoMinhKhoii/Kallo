'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface TargetProgressBarProps {
  /** Current percent toward target (0..100+); null when no target is set. */
  percentOfTarget: number | null;
  /** Whether to switch to the danger color (e.g. ceiling exceeded). */
  showExceed: boolean;
  /** Animation delay for the fill, seconds. */
  delay?: number;
  /** Animation duration for the fill, seconds. */
  duration?: number;
  /** ARIA label for assistive tech. */
  ariaLabel: string;
  /**
   * Optional fill color override (e.g. emerald for an adequate nutrient card).
   * When set, it wins over the default ink/danger/no-target fill and the
   * end-tick is dropped (the greened card already reads as "met").
   */
  fillColor?: string;
}

/**
 * Shared horizontal track used by spotlight rows, the steady detail panel,
 * and macro rows in the daily rhythm card. Uses `role="progressbar"` plus
 * aria-valuenow/min/max so screen readers announce a numeric value, not just
 * the visual label.
 */
export function TargetProgressBar({
  percentOfTarget,
  showExceed,
  delay = 0,
  duration = 0.7,
  ariaLabel,
  fillColor,
}: TargetProgressBarProps) {
  const hasValue = percentOfTarget !== null;
  const fillWidth = hasValue ? Math.min(100, Math.max(0, percentOfTarget)) : 0;
  // aria-valuenow must respect aria-valuemax (=100). The precise overshoot
  // percentage (e.g. "+87% over") is conveyed via ariaLabel + the figure text.
  const valueNow = hasValue ? Math.round(fillWidth) : undefined;

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valueNow}
      className="relative h-1 flex-1"
    >
      <div className="absolute inset-y-0 right-0 left-0 rounded-full bg-nham-track" />
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${fillWidth}%` }}
        transition={{ duration, ease: 'easeOut', delay }}
        style={fillColor ? { backgroundColor: fillColor } : undefined}
        className={cn(
          'absolute inset-y-0 left-0 rounded-full',
          fillColor
            ? ''
            : !hasValue
              ? 'bg-nham-stone/50'
              : showExceed
                ? 'bg-nham-danger'
                : 'bg-nham-text'
        )}
      />
      {hasValue && !fillColor ? (
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-[-3px] block h-[7px] w-px',
            showExceed ? 'bg-nham-danger/70' : 'bg-nham-stone/70'
          )}
          style={{ left: 'calc(100% - 1px)' }}
        />
      ) : null}
    </div>
  );
}
