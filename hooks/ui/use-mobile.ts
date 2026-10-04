import { useSyncExternalStore } from 'react';
import { MOBILE_QUERY } from '@/lib/core/ui/breakpoints';

function mobileQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
    ? window.matchMedia(MOBILE_QUERY)
    : null;
}

function subscribe(onChange: () => void) {
  const mql = mobileQuery();
  mql?.addEventListener('change', onChange);
  return () => mql?.removeEventListener('change', onChange);
}

/**
 * True below the `md` breakpoint (768px).
 *
 * Read synchronously, not from an effect: a component that mounts after
 * hydration — a modal rendered already open — gets the right answer on its
 * first render, so a phone never paints the desktop form and then swaps it.
 * The server (and the hydration pass) answer `false`.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => mobileQuery()?.matches ?? false,
    () => false
  );
}
