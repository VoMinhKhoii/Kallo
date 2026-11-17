'use client';

import { useEffect, useRef } from 'react';

/**
 * Runs `onFrame` at most once per painted frame while the page scrolls or
 * resizes, and once on mount. Callers write CSS variables straight to the DOM
 * from it, so scroll-linked motion never re-renders React.
 */
export function useScrollFrame(onFrame: () => void): void {
  const latest = useRef(onFrame);
  useEffect(() => {
    latest.current = onFrame;
  });

  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        latest.current();
      });
    };
    latest.current();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);
}
