import { useEffect, useState } from 'react';

// Heuristic: on mobile the on-screen keyboard shrinks the visual viewport
// well below the layout viewport. When that gap crosses this threshold we
// treat the keyboard as open and hide the bottom tab bar so it doesn't float
// over the composer.
const KEYBOARD_GAP_PX = 140;

/**
 * Tracks whether the on-screen keyboard is (likely) open, using the
 * `visualViewport` API. Returns `false` on browsers without `visualViewport`.
 *
 * This is a browser-event subscription, not data fetching — `useEffect` is the
 * correct tool here.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const gap = window.innerHeight - vv.height;
      setOpen(gap > KEYBOARD_GAP_PX);
    };

    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);

  return open;
}
