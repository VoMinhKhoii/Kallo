'use client';

import { useLayoutEffect } from 'react';
import { useResolvedTheme } from '@/hooks/theme/use-theme-choice';
import { paintTheme } from '@/lib/core/theme/paint-theme';
import { THEME_COLOR, THEME_STORAGE_KEY } from '@/lib/core/theme/themes';

/**
 * Keeps the page painted in the stored theme after the first load: on a change
 * in Settings, in another tab or in the OS, and whenever its page comes back
 * into view (Next keeps pages mounted but hidden; their effects re-run on
 * reveal). It reads storage at paint time rather than trusting its last
 * render, so a page revealed after the theme changed elsewhere paints the
 * current choice before the browser does.
 */
export function ThemeApplier() {
  // Subscribes this component to the theme so a change re-renders it.
  useResolvedTheme();

  useLayoutEffect(() => {
    paintTheme(THEME_STORAGE_KEY, THEME_COLOR);
  });

  return null;
}
