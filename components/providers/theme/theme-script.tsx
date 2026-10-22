'use client';

import { useSyncExternalStore } from 'react';
import { paintTheme } from '@/lib/core/theme/paint-theme';
import { THEME_COLOR, THEME_STORAGE_KEY } from '@/lib/core/theme/themes';

const SCRIPT = `(${paintTheme.toString()})(${JSON.stringify(THEME_STORAGE_KEY)},${JSON.stringify(THEME_COLOR)})`;
const subscribeNever = () => () => {};

/**
 * Paints the stored theme before first paint: the page class, its
 * colour-scheme and the browser-bar colour. Without it a reload in Dark or
 * Aurora would flash the light page until React hydrated. `ThemeApplier`
 * keeps the page in step afterwards.
 *
 * Rendered only in the server HTML (and kept through hydration): a script
 * React creates on a client navigation never runs, and React warns about it.
 */
export function ThemeScript() {
  const inServerHtml = useSyncExternalStore(
    subscribeNever,
    () => false,
    () => true
  );
  if (!inServerHtml) return null;

  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: a constant built from our own paint function and theme table, never user input — it must run before paint, which only an inline script can.
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
      suppressHydrationWarning
    />
  );
}
