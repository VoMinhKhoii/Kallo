'use client';

import type { RefObject } from 'react';
import { useScrollFrame } from './use-scroll-frame';

/** Where the element's top sits, as a share of the viewport, once settled. */
const SETTLED_AT = 0.2;

/**
 * Eases `--settle` from `from` down to 1 as the element scrolls up the screen.
 * The element's real size is its settled size and it is scaled up from there,
 * so nothing below it moves. It needs a top transform origin, or the measured
 * top would shift with the scale.
 */
export function useScrollSettle(
  ref: RefObject<HTMLElement | null>,
  from: number
): void {
  useScrollFrame(() => {
    const element = ref.current;
    if (
      !element ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const { top } = element.getBoundingClientRect();
    const screen = window.innerHeight;
    // Something already on screen at the top of the page starts from where it
    // first sits, so it is at full size until the reader scrolls.
    const start = Math.min(top + window.scrollY, screen);
    const end = screen * SETTLED_AT;
    const remaining = Math.min(1, Math.max(0, (top - end) / (start - end)));
    element.style.setProperty('--settle', String(1 + (from - 1) * remaining));
  });
}
