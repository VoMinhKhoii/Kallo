'use client';

import { type RefObject, useEffect } from 'react';

/**
 * Plays the `data-reveal` fade-up (globals.css) on each block inside `root`
 * the first time it is 80px into the viewport, as motion's
 * `whileInView={{ once: true, margin: '-80px' }}` did.
 *
 * The server's HTML never hides anything: every block plays the fade on first
 * paint. Once hydrated, this hides only the blocks that are still entirely
 * below the viewport (nobody can see them go), then plays the fade again as
 * each one scrolls in. A block already on screen, or scrolled past before the
 * scripts arrived, is left alone.
 */
export function useScrollReveal(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const blocks = root.current?.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!blocks?.length || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.reveal = 'shown';
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '-80px' }
    );

    for (const block of blocks) {
      if (block.dataset.reveal === 'shown') continue;
      if (block.getBoundingClientRect().top < window.innerHeight) continue;
      block.dataset.reveal = 'pending';
      observer.observe(block);
    }

    return () => observer.disconnect();
  }, [root]);
}
