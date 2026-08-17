'use client';

import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/core/ui/cn';
import {
  EMPTY_ENTRANCE,
  ENTRANCE_EASE,
} from '@/lib/domain/logging/empty-entrance';

/**
 * The warm halo behind the meal composer.
 *
 * The composer is the one thing the logging page asks you to do, and it sat on
 * flat canvas — correct, and completely inert. The halo makes it the page's lit
 * surface without adding a border, a fill or a shadow to the input itself.
 *
 * Purely decorative: `aria-hidden`, and `pointer-events-none` so it never eats
 * a click meant for the field it sits under. The gradient lives in
 * `--kallo-composer-glow` (light and dark) rather than here, so the colour
 * decision stays with the palette — including the rule that every radius has to
 * stay inside this box, or its rectangle shows.
 */
export function ComposerGlow({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.7,
        delay: EMPTY_ENTRANCE.glow,
        ease: ENTRANCE_EASE,
      }}
      className={cn(
        // Bleeds well past the input on every side, and SYMMETRICALLY: the
        // gradient is centred in this box, so an uneven inset would hang the
        // light above or below the thing it is meant to be lighting.
        'pointer-events-none absolute -inset-x-24 -inset-y-36 z-0',
        className
      )}
      style={{ background: 'var(--kallo-composer-glow)' }}
    />
  );
}
