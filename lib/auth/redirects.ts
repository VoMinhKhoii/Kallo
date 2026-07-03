// Shared redirect helpers for the auth route handlers (`/auth/callback`,
// `/auth/verify`). Kept in one place so the open-redirect guard and the
// reverse-proxy host handling can't drift between them.

import type { NextRequest } from 'next/server';
import { defaultLocale } from '@/i18n/config';

/** Locale to use for landing/error redirects, inferred from the (already
 * validated) `next` path; falls back to the default locale. The `en|vi`
 * literal still duplicates `i18n/config`'s `locales` (see the auth-gateway
 * review-followups task). */
export function localeFromNext(next: string | null): string {
  if (!next) return defaultLocale;
  return next.match(/^\/(en|vi)(\/|$)/)?.[1] ?? defaultLocale;
}

/**
 * Build a URL using the externally-facing host. Behind a reverse proxy
 * (Cloud Run, Vercel, etc.) `request.url`'s host reflects the container's
 * internal listen address (e.g. `0.0.0.0:8080`), not the public hostname.
 * Prefer `x-forwarded-host` / `x-forwarded-proto` when present so the
 * `Location` header points the browser at a reachable origin.
 */
export function publicUrl(
  request: NextRequest,
  path: string,
  fallbackOrigin: string
): URL {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedHost) {
    const proto = forwardedProto ?? 'https';
    return new URL(path, `${proto}://${forwardedHost}`);
  }
  return new URL(path, fallbackOrigin);
}
