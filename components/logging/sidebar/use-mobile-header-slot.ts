'use client';

import { useSyncExternalStore } from 'react';

/**
 * The header slot the date chip renders into, when there is one.
 *
 * `MobileNav` puts the slot in the DOM at every width but only shows its header
 * below `md`. Portalling into it from `md` up hides the chip completely — which
 * is exactly what happened when the timeline sidebar moved from `md` to `lg`
 * and left 768px with neither the sidebar nor the chip. So the slot counts as a
 * target only while that header is actually on screen; above it the caller
 * renders the chip inline instead.
 *
 * `matchMedia` is absent in jsdom (and in any host without it). Falling back to
 * `null` is the safe branch: the chip is visible either way, it just does not
 * share the hamburger's row.
 */
const MOBILE_HEADER_SLOT_ID = 'app-mobile-header-slot';
const MOBILE_HEADER_QUERY = '(max-width: 767.98px)';

const query = () =>
  typeof window.matchMedia === 'function'
    ? window.matchMedia(MOBILE_HEADER_QUERY)
    : null;

const subscribe = (onChange: () => void) => {
  const mql = query();
  mql?.addEventListener('change', onChange);
  return () => mql?.removeEventListener('change', onChange);
};

// Resolved lazily so SSR returns null (no DOM) and the client picks the slot up
// on its first commit without a setState in an effect.
const getSlot = (): HTMLElement | null =>
  query()?.matches ? document.getElementById(MOBILE_HEADER_SLOT_ID) : null;

const getNoSlot = (): HTMLElement | null => null;

export function useMobileHeaderSlot(): HTMLElement | null {
  return useSyncExternalStore(subscribe, getSlot, getNoSlot);
}
