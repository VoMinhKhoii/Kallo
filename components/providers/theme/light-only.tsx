'use client';

import { useLayoutEffect } from 'react';
import { DARK_THEME_CLASSES, THEME_COLOR } from '@/lib/core/theme/themes';

/**
 * Rendered by the pages that stay light whatever the user picked: the
 * marketing site, docs and legal pages.
 *
 * A direct visit is already light — these pages render no theme provider, so
 * no script sets a theme class. This covers the client navigation INTO one of
 * them from the app (signing out lands on `/`, Settings links to docs): the
 * app's provider leaves its class on <html> when it unmounts, so it is taken
 * off here before the page paints.
 */
export function LightOnly() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.remove(...DARK_THEME_CLASSES);
    html.style.colorScheme = 'light';
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLOR.light);
  }, []);

  return null;
}
