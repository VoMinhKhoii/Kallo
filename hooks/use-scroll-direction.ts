'use client';

import { useEffect, useRef, useState } from 'react';

export type ScrollDirection = 'up' | 'down';

/**
 * Tracks vertical scroll direction with a small threshold to ignore noise.
 * Uses a passive listener for performance.
 */
export function useScrollDirection(threshold = 8): ScrollDirection {
  const [direction, setDirection] = useState<ScrollDirection>('up');
  const lastYRef = useRef(0);
  const tickingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    lastYRef.current = window.scrollY;

    function update() {
      const currentY = window.scrollY;
      const diff = currentY - lastYRef.current;
      if (Math.abs(diff) > threshold) {
        setDirection(diff > 0 ? 'down' : 'up');
        lastYRef.current = currentY;
      }
      tickingRef.current = false;
    }

    function onScroll() {
      if (tickingRef.current) return;
      tickingRef.current = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return direction;
}
