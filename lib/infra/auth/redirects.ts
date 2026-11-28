// Shared redirect helpers for the auth route handlers (`/auth/callback`,
// `/auth/verify`). Kept in one place so the open-redirect guard and the
// reverse-proxy host handling can't drift between them.

import type { NextRequest } from 'next/server';
import { defaultLocale, isLocale, type Locale } from '@/i18n/config';
import { isCloudRunHost } from '@/lib/infra/http/cloud-run-host';
import { SITE_URL } from '@/lib/seo/site';

/**
 * The `?error=` codes the auth routes redirect to the landing page with. The
 * landing page's `AuthErrorToast` maps every one of them to a message, so a
 * code added here without one fails the type check there.
 */
export type AuthErrorCode =
  | 'oauth_missing_code'
  | 'oauth_exchange'
  | 'account_exists'
  | 'verify_failed';

/** Locale to use for landing/error redirects, inferred from the (already
 * validated) `next` path; falls back to the default locale. */
export function localeFromNext(next: string | null): Locale {
  const first = next?.split('/')[1];
  return isLocale(first) ? first : defaultLocale;
}

/**
 * Build a URL using the externally-facing host. Behind a reverse proxy
 * (Cloud Run, Vercel, etc.) `request.url`'s host reflects the container's
 * internal listen address (e.g. `0.0.0.0:8080`), not the public hostname.
 * Prefer `x-forwarded-host` / `x-forwarded-proto` when present so the
 * `Location` header points the browser at a reachable origin.
 *
 * Never a Cloud Run origin (KALLO-11). Cloudflare rewrites `Host` to the
 * `*.run.app` hostname, so whenever `x-forwarded-host` is missing the fallback
 * origin IS that hostname — and a redirect built from it tells anyone who asks
 * which address skips the edge WAF. Those cases land on the canonical public
 * origin instead.
 */
export function publicUrl(
  request: NextRequest,
  path: string,
  fallbackOrigin: string
): URL {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const url = forwardedHost
    ? new URL(path, `${forwardedProto ?? 'https'}://${forwardedHost}`)
    : new URL(path, fallbackOrigin);
  return isCloudRunHost(url.hostname) ? new URL(path, SITE_URL) : url;
}

/** The landing page with an auth error for `AuthErrorToast` to show. */
export function authErrorUrl(
  request: NextRequest,
  locale: Locale,
  code: AuthErrorCode,
  fallbackOrigin: string
): URL {
  return publicUrl(request, `/${locale}/?error=${code}`, fallbackOrigin);
}
