'use client';

import { type RefObject, useRef } from 'react';
import { useScrollFrame } from './use-scroll-frame';

/**
 * Publishes `--under-heading` on an element: how far it has slid beneath a
 * pinned heading ending `pinnedRem` down the screen. The element's CSS mask
 * reads it, so content fades out along that line instead of running through
 * a heading that has no fill of its own.
 */
export function useFadeUnderPinned(
  target: RefObject<HTMLElement | null>,
  pinnedRem: number
): void {
  const rem = useRef(16);

  useScrollFrame(() => {
    const element = target.current;
    if (!element) return;
    rem.current = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize
    );
    // A little past the pinned box, so the fade clears the title's underline.
    const line = pinnedRem * rem.current + 10;
    element.style.setProperty(
      '--under-heading',
      `${Math.max(0, line - element.getBoundingClientRect().top)}px`
    );
  });
}
