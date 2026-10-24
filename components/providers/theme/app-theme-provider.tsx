import type { ReactNode } from 'react';
import { ThemeApplier } from './theme-applier';
import { ThemeScript } from './theme-script';

/**
 * Turns on the user's theme (Settings → Appearance) for the pages under it.
 *
 * It wraps the app's own pages — the signed-in shell, /pricing, invite links,
 * password reset and the landing page — and NOT the locale root, because docs
 * and legal pages stay light (they render `LightOnly` instead). Several
 * copies can be mounted at once (Next keeps visited pages alive); they hold no
 * state of their own, only the stored choice, so they never disagree.
 */
export function AppThemeProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <ThemeScript />
      <ThemeApplier />
      {children}
    </>
  );
}
