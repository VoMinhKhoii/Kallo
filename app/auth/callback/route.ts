import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const DEFAULT_LOCALE = 'en';
const SUPPORTED_LOCALES = ['en', 'vi'] as const;

// Strict allowlist: same-origin path that begins with a supported locale.
// We reject anything containing control chars, backslashes, or whitespace,
// because `new URL()` strips leading ASCII tab/LF/CR from a path and will
// happily turn "/\t/evil.com" into "http://evil.com/" (open redirect).
const SAFE_NEXT_RE = /^\/(en|vi)(\/[\w\-./?&=%#]*)?$/;

function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.length > 512) return null;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
  // Reject CR/LF/TAB/NUL and any other control chars or backslashes anywhere.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: deliberate guard
  if (/[\x00-\x1f\x7f\\]/.test(raw)) return null;
  if (!SAFE_NEXT_RE.test(raw)) return null;
  return raw;
}

function localeFromNext(next: string | null): string {
  if (!next) return DEFAULT_LOCALE;
  const match = next.match(/^\/(en|vi)(\/|$)/);
  const candidate = match?.[1];
  return (SUPPORTED_LOCALES as readonly string[]).includes(candidate ?? '')
    ? (candidate as string)
    : DEFAULT_LOCALE;
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
  const next = safeNext(url.searchParams.get('next'));
  const locale = localeFromNext(next);

  if (!code) {
    return NextResponse.redirect(
      new URL(`/${locale}/?error=oauth_missing_code`, url.origin)
    );
  }

  const supabase = deps?.supabase ?? (await createClient());
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/${locale}/?error=oauth_exchange`, url.origin)
    );
  }

  const target = next ?? `/${locale}/logging`;
  return NextResponse.redirect(new URL(target, url.origin));
}

export async function GET(request: NextRequest) {
  return handleAuthCallback(request);
}
