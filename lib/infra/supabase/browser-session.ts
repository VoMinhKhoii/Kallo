import { parseCookieHeader, stringFromBase64URL } from '@supabase/ssr';
import { createClient } from '@/lib/infra/supabase/client';
import { sessionCookieName } from '@/lib/infra/supabase/cookie-options';

/**
 * Matches `@supabase/auth-js`'s `EXPIRY_MARGIN_MS` (3 × 30 s). Any session
 * inside this window would trigger a server-side token refresh on every
 * concurrent `/api/v1/*` request that reaches Cloud Run before the browser
 * refreshes it.
 */
export const BROWSER_SESSION_EXPIRY_MARGIN_MS = 90_000;

const BASE64_PREFIX = 'base64-';

let inFlightRefresh: Promise<void> | null = null;

function readSessionCookieValue(name: string): string | null {
  const cookies = parseCookieHeader(document.cookie);
  const byName = new Map<string, string>();
  for (const cookie of cookies) {
    if (cookie.value) byName.set(cookie.name, cookie.value);
  }
  const direct = byName.get(name);
  if (direct) return direct;

  const chunks: string[] = [];
  for (let i = 0; ; i += 1) {
    const chunk = byName.get(`${name}.${i}`);
    if (!chunk) break;
    chunks.push(chunk);
  }
  return chunks.length > 0 ? chunks.join('') : null;
}

function parseSessionCookie(raw: string): {
  expiresAt?: number;
  hasRefreshToken: boolean;
} | null {
  try {
    const json = raw.startsWith(BASE64_PREFIX)
      ? stringFromBase64URL(raw.slice(BASE64_PREFIX.length))
      : raw;
    const parsed = JSON.parse(json) as {
      expires_at?: unknown;
      refresh_token?: unknown;
    };
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      expiresAt:
        typeof parsed.expires_at === 'number' ? parsed.expires_at : undefined,
      hasRefreshToken:
        typeof parsed.refresh_token === 'string' &&
        parsed.refresh_token.length > 0,
    };
  } catch {
    return null;
  }
}

/**
 * Synchronous check for whether the browser holds a session cookie whose access
 * token has expired (or is inside Supabase's 90 s refresh margin). Returns
 * `false` when signed out, when the token is fresh, or outside a browser.
 */
export function needsBrowserSessionRefresh(now = Date.now()): boolean {
  if (
    typeof document === 'undefined' ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  ) {
    return false;
  }
  let name: string;
  try {
    name = sessionCookieName();
  } catch {
    return false;
  }
  const raw = readSessionCookieValue(name);
  if (!raw) return false;
  const session = parseSessionCookie(raw);
  if (!session?.hasRefreshToken || session.expiresAt === undefined) {
    return false;
  }
  return session.expiresAt * 1000 - now < BROWSER_SESSION_EXPIRY_MARGIN_MS;
}

function raceWithAbort(
  promise: Promise<void>,
  signal: AbortSignal | null | undefined
): Promise<void> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const onAbort = () => resolve();
    signal.addEventListener('abort', onAbort, { once: true });
    promise.finally(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    });
  });
}

/**
 * When a returning web tab wakes up with an expired session cookie, refresh the
 * token once in the browser before firing a parallel burst of `/api/v1/*`
 * requests. Otherwise every request in the burst reaches Cloud Run carrying the
 * expired cookie and blocks server-side on GoTrue for ~1.5–2 s.
 *
 * On the normal (fresh-token) path this performs one synchronous cookie check
 * and adds zero network calls. Failures (including synchronous client init
 * errors) are swallowed so the caller's own fetch still runs and surfaces
 * normal 401/error handling.
 */
export async function ensureFreshBrowserSession(
  signal?: AbortSignal | null
): Promise<void> {
  if (signal?.aborted) return;
  if (!inFlightRefresh && !needsBrowserSessionRefresh()) return;

  if (!inFlightRefresh) {
    const pending = (async () => {
      try {
        await createClient().auth.getSession();
      } catch {
        // Swallowed so callers fall through to normal fetch / 401 handling.
      }
    })().finally(() => {
      if (inFlightRefresh === pending) inFlightRefresh = null;
    });
    inFlightRefresh = pending;
  }

  await raceWithAbort(inFlightRefresh, signal);
}

/** Reset module-level in-flight state between unit tests. */
export function resetBrowserSessionRefreshForTests(): void {
  inFlightRefresh = null;
}
