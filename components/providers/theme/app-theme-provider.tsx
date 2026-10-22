'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { APP_THEMES, THEME_STORAGE_KEY } from '@/lib/core/theme/themes';
import { ThemeColorSync } from './theme-color-sync';

/**
 * Turns on the user's theme (Settings → Appearance) for the pages under it.
 *
 * It wraps the app's own pages — the signed-in shell, /pricing, invite links
 * and password reset — and NOT the locale root, because the marketing site,
 * docs and legal pages stay light (they render `LightOnly` instead). It cannot
 * sit at the root and be switched off below: next-themes ignores a nested
 * provider, so a page-level `forcedTheme` would never take effect.
 *
 * next-themes writes the theme as a class on <html> from an inline script
 * before first paint, so a reload in dark mode never flashes cream.
 */
export function AppThemeProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <ThemeProvider
      attribute="class"
      themes={[...APP_THEMES]}
      defaultTheme="system"
      enableSystem
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      <ThemeColorSync />
      {children}
    </ThemeProvider>
  );
}
