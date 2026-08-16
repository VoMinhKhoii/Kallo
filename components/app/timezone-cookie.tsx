'use client';

import { useEffect } from 'react';

/** Where the browser leaves its UTC offset for the server to read. */
export const TIMEZONE_COOKIE = 'nham_tzo';

/**
 * Writes the browser's UTC offset into a cookie, once per load.
 *
 * A local day is a window in UTC, and which window depends on the offset — so
 * any server-side question of the form "what happened today?" cannot be
 * answered without it. `Intl` on the server only knows the SERVER's zone, and
 * guessing UTC puts a UTC+7 user's midnight-to-07:00 meals on the wrong day.
 *
 * The offset is not identifying on its own (it is one of ~40 values, shared
 * with everyone in the timezone) and it is what the client already sends with
 * every day query.
 *
 * Deliberately best-effort: on a first-ever visit the cookie does not exist
 * yet, and everything that reads it falls back to not knowing rather than to
 * being wrong.
 */
export function TimezoneCookie() {
  useEffect(() => {
    const offset = new Date().getTimezoneOffset();
    // Lax, not None: it is only ever read by this app's own navigations.
    document.cookie = `${TIMEZONE_COOKIE}=${offset}; path=/; max-age=31536000; SameSite=Lax`;
  }, []);

  return null;
}
