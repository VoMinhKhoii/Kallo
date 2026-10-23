'use client';

import { useSyncExternalStore } from 'react';
import { paintTheme } from '@/lib/core/theme/paint-theme';
import { THEME_COLOR, THEME_STORAGE_KEY } from '@/lib/core/theme/themes';

/**
 * A value as JSON that is safe inside a <script> body: `<` (so nothing can
 * close the tag) and the two JSON-legal line separators JavaScript treats as
 * line breaks are escaped. The values are our own constants; this keeps them
 * safe if one ever is not.
 */
function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const SCRIPT = `(${paintTheme.toString()})(${scriptJson(THEME_STORAGE_KEY)},${scriptJson(THEME_COLOR)})`;
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
