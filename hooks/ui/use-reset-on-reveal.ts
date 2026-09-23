'use client';

import { useLayoutEffect, useRef } from 'react';

/**
 * Runs `reset` each time the component is shown again after being hidden by
 * React `<Activity>` — which is what Cache Components does to a page the user
 * navigated away from — and never on the first mount.
 *
 * Why on reveal, not on hide: a hide cleanup runs once, as the page is
 * hidden. A submission still in flight then can settle afterwards and set its
 * "sent" / "Saved" / error state while the page is hidden, and nothing clears
 * it before the user comes back. Activity re-runs effect setups when a hidden
 * tree becomes visible again (React 19.2 `reappearLayoutEffects`, also in the
 * canary Next bundles), and a layout-effect setup runs before paint, so the
 * stale state never shows.
 *
 * `reset` should clear transient results only — confirmations, errors — and
 * leave drafts alone. It always sees the latest render's values. (In React
 * Strict Mode's development double-mount it also runs once on mount; the
 * transient state is empty then, so that is harmless.)
 */
export function useResetOnReveal(reset: () => void) {
  const latestReset = useRef(reset);
  // Layout effects run in order, so on a reveal this refresh lands before the
  // effect below reads it.
  useLayoutEffect(() => {
    latestReset.current = reset;
  });

  const hasMounted = useRef(false);
  useLayoutEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    latestReset.current();
  }, []);
}
