import type { CookieOptions, CookieOptionsWithName } from '@supabase/ssr';

// One definition of the Supabase session cookie's attributes, shared by the
// browser client, the server client and the middleware so all three write the
// cookie (and every `.0`, `.1`, ... chunk of it) identically (KALLO-06).

const DAY_SECONDS = 60 * 60 * 24;

/**
 * The HSTS max-age kallo.fit is served with. HSTS is owned by Cloudflare, not
 * the app (see the note in next.config.ts), so this constant documents the
 * edge setting rather than emitting it: Cloudflare's "6 months" option is
 * 15552000 seconds, which is what the 2026-09 pentest observed. If the edge
 * policy is shortened, lower this constant too; the cookie-options test then
 * forces SESSION_COOKIE_MAX_AGE_SECONDS back under it.
 */
export const EXPECTED_HSTS_MAX_AGE_SECONDS = 180 * DAY_SECONDS;

/**
 * How long an idle browser keeps the session cookie. Every token refresh
 * (at least hourly while the app is open, jwt_expiry = 3600) rewrites the
 * cookie and restarts this clock, so in practice it is the inactivity window
 * after which a user must sign in again. Refresh tokens themselves never
 * expire (no [auth.sessions] timebox in supabase/config.toml), so this is the
 * effective session limit.
 *
 * 90 days is generous for a daily food-logging app and stays well under the
 * HSTS max-age: a cookie that outlives the browser's HSTS entry can be sent
 * over plain HTTP on the next typed `kallo.fit` visit, before Cloudflare's
 * redirect to HTTPS. The @supabase/ssr default is 400 days.
 */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 90 * DAY_SECONDS;

/**
 * Whether the cookie gets the `Secure` attribute (sent over HTTPS only).
 * Always true in production builds: Next inlines NODE_ENV into the client
 * bundle, so no runtime value can switch it off. Outside production the
 * browser only drops it on a plain-http page (e.g. `bun dev` opened from a
 * phone on the LAN), where a Secure cookie would be silently rejected.
 */
export function isSecureCookieContext(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  if (typeof window !== 'undefined') {
    return window.location.protocol === 'https:';
  }
  return true;
}

/**
 * The session cookie name. supabase-js derives it from the Supabase URL's
 * first hostname label; it is pinned explicitly because the browser client
 * talks to the same-origin proxy, whose URL would derive a different name.
 */
export function sessionCookieName(): string {
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(
    '.'
  )[0];
  return `sb-${ref}-auth-token`;
}

/** The `cookieOptions` every Supabase client in the app is created with. */
export function sessionCookieOptions(): CookieOptionsWithName {
  return {
    name: sessionCookieName(),
    path: '/',
    sameSite: 'lax',
    secure: isSecureCookieContext(),
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  };
}

/**
 * Applies the session attributes to options @supabase/ssr hands to `setAll`.
 * Needed because @supabase/ssr 0.8 honours `cookieOptions.secure`, `path` and
 * `sameSite` but overwrites `maxAge` with its 400-day default on every write
 * (see `setCookieOptions` in its cookies.js). Deletions (maxAge 0) stay
 * deletions.
 */
export function sessionCookieWriteOptions(
  options: CookieOptions | undefined
): CookieOptions {
  const { name: _name, ...attributes } = sessionCookieOptions();
  return {
    ...options,
    ...attributes,
    maxAge: options?.maxAge === 0 ? 0 : SESSION_COOKIE_MAX_AGE_SECONDS,
  };
}
