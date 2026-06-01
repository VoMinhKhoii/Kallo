import { type NextRequest, NextResponse } from 'next/server';
import { safeNextPath } from '@/lib/auth/safe-next';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const DEFAULT_LOCALE = 'en';
const SUPPORTED_LOCALES = ['en', 'vi'] as const;

function localeFromNext(next: string | null): string {
  if (!next) return DEFAULT_LOCALE;
  const match = next.match(/^\/(en|vi)(\/|$)/);
  const candidate = match?.[1];
  return (SUPPORTED_LOCALES as readonly string[]).includes(candidate ?? '')
    ? (candidate as string)
    : DEFAULT_LOCALE;
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

/**
 * Handles the OAuth code-exchange and computes the redirect. Exported as a
 * plain helper so tests can inject a mocked Supabase client without leaking
 * the seam through the route handler's public contract (Next 16's `RouteContext`
 * reserves the second positional parameter of `GET`).
 */
export async function handleAuthCallback(
  request: NextRequest,
  deps?: { supabase?: Awaited<ReturnType<typeof createClient>> }
): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNextPath(url.searchParams.get('next'));
  const locale = localeFromNext(next);

  if (!code) {
    return NextResponse.redirect(
      publicUrl(request, `/${locale}/?error=oauth_missing_code`, url.origin)
    );
  }

  const supabase = deps?.supabase ?? (await createClient());
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      publicUrl(request, `/${locale}/?error=oauth_exchange`, url.origin)
    );
  }

  const target = next ?? `/${locale}/logging`;
  return NextResponse.redirect(publicUrl(request, target, url.origin));
}

export async function GET(request: NextRequest) {
  return handleAuthCallback(request);
}
