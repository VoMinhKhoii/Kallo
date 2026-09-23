import { isCloudRunHost } from '@/lib/infra/http/cloud-run-host';
import { AUTH_PATH_PREFIX } from './canonical-auth-path';

/**
 * Where a browser should be sent when GoTrue answers with a `Location`, or
 * `null` when the header must not reach the client at all.
 *
 * The proxy uses `redirect: 'manual'` so `/authorize` and `/verify` can bounce
 * the browser on to Google or to the app's `redirect_to`. Passing every
 * `Location` through untouched, though, let the upstream decide which hosts
 * our origin advertises (KALLO-11 recorded an absolute redirect that disclosed
 * the Cloud Run `*.run.app` hostname — the one address that skips Cloudflare).
 * The rules:
 *
 *  - Supabase's own origin (absolute, or a relative reference, which resolves
 *    against it): the browser cannot reach `supabase.co` on the networks this
 *    proxy exists for, so an `/auth/v1/*` target is rewritten onto the proxy's
 *    same-origin path. Anything else there (`/rest/v1`, `/storage`…) is a
 *    surface this proxy refuses, so it is dropped rather than advertised.
 *  - A Cloud Run origin (`*.run.app`): dropped. Nothing legitimate lives there
 *    — the public app is `kallo.fit` — and naming it helps an attacker aim at
 *    the origin instead of the edge.
 *  - Script-bearing schemes: dropped. GoTrue never sends one.
 *  - Everything else — `accounts.google.com`, the app's own `redirect_to`, a
 *    `localhost` target in development, the Flutter app's custom scheme — is
 *    passed through byte for byte, so OAuth parameters are not re-encoded.
 */

/** Public mount point of this proxy on the app's own origin. */
export const PROXY_MOUNT = '/api/supabase-proxy';

const DROPPED_SCHEMES = new Set(['javascript:', 'data:', 'vbscript:', 'file:']);

export function rewriteUpstreamLocation(
  location: string,
  upstreamUrl: URL
): string | null {
  let target: URL;
  try {
    target = new URL(location, upstreamUrl);
  } catch {
    return null;
  }

  if (DROPPED_SCHEMES.has(target.protocol)) return null;

  // By hostname, not origin: an `http:` or explicit-port spelling of the
  // Supabase host is still Supabase and must not slip through as "external".
  if (target.hostname === upstreamUrl.hostname) {
    if (!target.pathname.startsWith(AUTH_PATH_PREFIX)) return null;
    return `${PROXY_MOUNT}${target.pathname}${target.search}${target.hash}`;
  }

  if (isCloudRunHost(target.hostname)) return null;

  return location;
}
