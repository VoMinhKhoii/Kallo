'use client';

import { type RefObject, useEffect } from 'react';

/**
 * Removes the dead space under a pile of sticky cards.
 *
 * Each card's sticky box is a fixed height so the pile releases on time, and
 * the last card's visible panel is shorter. Pulling the next section up by
 * that spare height, plus the box's margin and the section's padding, leaves
 * the same gap as everywhere else on the page. The margin goes on the section
 * so no sticky measurement sees it.
 */
export function useClosePileGap(
  section: RefObject<HTMLElement | null>,
  pile: RefObject<HTMLElement | null>
): void {
  useEffect(() => {
    const host = section.current;
    const box = pile.current?.lastElementChild as HTMLElement | null;
    const card = box?.querySelector<HTMLElement>('[data-stack-card]');
    if (!host || !box || !card) return;

    const measure = () => {
      if (!window.matchMedia('(min-width: 48rem)').matches) {
        host.style.marginBottom = '';
        return;
      }
      const spare = box.offsetHeight - card.offsetHeight;
      const margin = Number.parseFloat(getComputedStyle(box).marginBottom);
      const padding = Number.parseFloat(getComputedStyle(host).paddingBottom);
      host.style.marginBottom = `${-(spare + margin + padding)}px`;
    };
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(card);
    return () => observer.disconnect();
  }, [section, pile]);
}
