'use client';

import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import {
  APP_THEMES,
  type AppTheme,
  THEME_COLOR,
} from '@/lib/core/theme/themes';

/**
 * Keeps `<meta name="theme-color">` on the resolved theme's canvas, so the
 * browser bar and a standalone PWA's status-bar zone continue the page instead
 * of showing the light layout's `#fcfcfc` above a dark app.
 */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const theme: AppTheme = (APP_THEMES as readonly string[]).includes(
      resolvedTheme ?? ''
    )
      ? (resolvedTheme as AppTheme)
      : 'light';
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLOR[theme]);
  }, [resolvedTheme]);

  return null;
}
