'use client';

import { motion } from 'motion/react';
import {
  COMPOSITION_COLORS,
  type CompositionSegment,
} from '@/components/shared/nutrition/composition';
import { cn } from '@/lib/core/ui/cn';

/**
 * The stacked macro bar: one segment per macro, each sized by its share of the
 * meal's (or the day's) calories.
 *
 * The default is the nutrition page's: 8px, segments meeting flush, full
 * pigment. That surface draws ONE bar per screen, large, where saturation costs
 * nothing. A surface repeating the bar down a LIST pays for it on every row, so
 * `compact` takes the weight back out — shorter, gapped and softened, because
 * the same mark at full weight read as candy stripes once it appeared on every
 * row.
 *
 * Zero-width segments are dropped rather than rendered at 0, so a meal with no
 * fat gives two segments meeting cleanly instead of a hairline seam.
 *
 * Mirrors `apps/mobile-flutter/lib/shared/widgets/nutrition/composition_bar.dart`.
 */

interface CompositionBarProps {
  segments: CompositionSegment[];
  variant?: 'full' | 'compact';
  /** Set when the bar is the only thing carrying the split on that surface. */
  ariaLabel?: string;
  className?: string;
}

export function CompositionBar({
  segments,
  variant = 'full',
  ariaLabel,
  className,
}: CompositionBarProps) {
  const visible = segments.filter((segment) => segment.pct > 0);
  const compact = variant === 'compact';
  // Labelled when the bar is the only thing carrying the split; hidden when a
  // macro scale under it already says the same in words.
  const a11y = ariaLabel
    ? ({ role: 'img', 'aria-label': ariaLabel } as const)
    : ({ 'aria-hidden': true } as const);

  return (
    <div
      {...a11y}
      className={cn(
        'flex w-full overflow-hidden rounded-full',
        compact ? 'h-1.5 gap-0.5' : 'h-2 bg-kallo-track',
        className
      )}
    >
      {visible.map((segment) => (
        <motion.span
          animate={{ scaleX: 1 }}
          className={cn('h-full', compact && 'rounded-full')}
          initial={{ scaleX: 0 }}
          key={segment.key}
          style={{
            width: `${segment.pct}%`,
            backgroundColor: COMPOSITION_COLORS[segment.key],
            transformOrigin: 'left',
            // Below full the segments lighten toward the page, which is how a
            // repeated bar stops shouting without leaving the palette.
            opacity: compact ? 0.8 : 1,
          }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}
