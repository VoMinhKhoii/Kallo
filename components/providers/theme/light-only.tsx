'use client';

import { useLayoutEffect } from 'react';
import { paintTheme } from '@/lib/core/theme/paint-theme';
import { THEME_COLOR, THEME_STORAGE_KEY } from '@/lib/core/theme/themes';

/**
 * Rendered by the pages that stay light whatever the user picked: the
 * marketing site, docs and legal pages.
 *
 * A direct visit is already light — these pages render no theme script. This
 * covers arriving from the app by client navigation (signing out lands on
 * `/`, Settings links to docs), and the page coming back into view later: the
 * app left its theme on <html>, so it is painted light here before the page
 * shows.
 */
export function LightOnly() {
  useLayoutEffect(() => {
    paintTheme(THEME_STORAGE_KEY, THEME_COLOR, 'light');
  });

  return null;
}
