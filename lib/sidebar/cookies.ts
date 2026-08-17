/**
 * Cookie-based persistence for sidebar UI preferences.
 *
 * Why cookies, not localStorage?
 * - Server components can read cookies on initial render (`next/headers`)
 *   and pass the correct state into the client tree, eliminating the
 *   first-paint flash and hydration mismatch.
 * - Cookies are scoped per-browser like localStorage but are SSR-readable.
 * - Pattern matches shadcn/ui's official Sidebar implementation.
 *
 * Cookie naming: snake_case, no colons (some user agents reject colons in
 * cookie names per stricter readings of RFC 6265).
 */

import type {
  SidebarExpandMode,
  SidebarRestingState,
} from '@/lib/sidebar/types';

export const SIDEBAR_STATE_COOKIE = 'kallo_sidebar_state';
export const SIDEBAR_EXPAND_MODE_COOKIE = 'kallo_sidebar_expand_mode';
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function parseSidebarState(
  raw: string | undefined
): SidebarRestingState | null {
  if (raw === 'closed' || raw === 'open') return raw;
  return null;
}

export function parseSidebarExpandMode(
  raw: string | undefined
): SidebarExpandMode | null {
  if (raw === 'click' || raw === 'hover') return raw;
  return null;
}

/**
 * Read a cookie value by name from the client. `undefined` on the server, and
 * for a value that is not decodable — a malformed cookie falls back to the
 * SSR-provided default rather than throwing through the hook's initializer.
 */
export function readSidebarCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
}

/** Write a cookie from the client. No-op on the server. */
export function writeSidebarCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  const isHttps = window.location.protocol === 'https:';
  const parts = [
    `${name}=${value}`,
    'Path=/',
    `Max-Age=${SIDEBAR_COOKIE_MAX_AGE}`,
    'SameSite=Lax',
  ];
  if (isHttps) parts.push('Secure');
  document.cookie = parts.join('; ');
}
