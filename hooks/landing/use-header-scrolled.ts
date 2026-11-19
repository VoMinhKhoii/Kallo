'use client';

import { useState } from 'react';
import { useScrollFrame } from './use-scroll-frame';

/**
 * Whether the page has moved off its top. The landing header stays clear over
 * the hero's painting at rest. Once content runs under it, it picks up its blur
 * on a phone and lifts into a floating bar on desktop.
 */
export function useHeaderScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useScrollFrame(() => setScrolled(window.scrollY > 24));
  return scrolled;
}
