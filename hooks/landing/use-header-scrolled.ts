'use client';

import { useEffect, useState } from 'react';

/**
 * Whether the page has moved off its top. The landing header stays clear over
 * the hero's painting at rest. Once content runs under it, it picks up its blur
 * on a phone and lifts into a floating bar on desktop.
 */
export function useHeaderScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return scrolled;
}
