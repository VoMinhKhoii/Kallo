'use client';

import { type MotionValue, useTransform } from 'motion/react';

/**
 * The day/night ink system, in one place: every text tone over the globe
 * stage interpolates between its daylight and night value off the shared
 * darkness motion value. Ink flips regimes faster than the ground morphs
 * (the 0.3→0.6 window) so contrast never dips through twilight.
 */

export interface Ink {
  /** Headlines, country names, dish names. */
  strong: MotionValue<string>;
  /** Secondary copy — dish adjustments. */
  mid: MotionValue<string>;
  /** Tertiary copy — country notes. */
  soft: MotionValue<string>;
  /** Uppercase eyebrows. */
  eyebrow: MotionValue<string>;
  /** Italic serif highlights. */
  accent: MotionValue<string>;
}

export function useInk(darkness: MotionValue<number>): Ink {
  const mix = useTransform(darkness, [0.3, 0.6], [0, 1], { clamp: true });
  return {
    strong: useTransform(mix, [0, 1], ['#2C2416', '#F5EDE0']),
    mid: useTransform(mix, [0, 1], ['#6B5D4F', '#B49C78']),
    soft: useTransform(mix, [0, 1], ['#7A6650', '#C4AA80']),
    eyebrow: useTransform(mix, [0, 1], ['#A9834E', '#C9A87C']),
    accent: useTransform(mix, [0, 1], ['#A9834E', '#D9BE93']),
  };
}
