import { type NextRequest, NextResponse } from 'next/server';
import { localeFromNext, publicUrl } from '@/lib/auth/redirects';
import { safeNextPath } from '@/lib/auth/safe-next';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Substring that identifies the `before_user_created` hook's duplicate-email
 * rejection. This is a hard contract with the SQL hook's error message — see
 * `supabase/migrations/20260629120000_block_duplicate_email_signup.sql` (and
 * the matching marker in the Flutter client's `authErrorMessage`). A test in
 * `route.test.ts` asserts the migration message still contains this string, so
 * editing the SQL prose without updating the clients fails loudly.
 */
export const DUPLICATE_EMAIL_MARKER = 'already exists for this email';

/** Returns true when a Supabase error message or description contains the
 * duplicate-email hook marker. Accepts null so callers can pass optional
 * query params without pre-coercing. */
function isDuplicateError(message: string | null): boolean {
  return (message ?? '').toLowerCase().includes(DUPLICATE_EMAIL_MARKER);
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

  // The `before_user_created` hook rejects duplicate-email signups; Supabase
  // then redirects here with `error`/`error_description` instead of a `code`.
  // Surface that as a friendly "account exists" toast rather than a dead-end.
  if (!code) {
    const providerError = url.searchParams.get('error');
    const providerErrorDescription = url.searchParams.get('error_description');
    if (providerError || providerErrorDescription) {
      const errorCode = isDuplicateError(providerErrorDescription)
        ? 'account_exists'
        : 'oauth_exchange';
      return NextResponse.redirect(
        publicUrl(request, `/${locale}/?error=${errorCode}`, url.origin)
      );
    }
    return NextResponse.redirect(
      publicUrl(request, `/${locale}/?error=oauth_missing_code`, url.origin)
    );
  }

  const supabase = deps?.supabase ?? (await createClient());
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const errorCode = isDuplicateError(error.message)
      ? 'account_exists'
      : 'oauth_exchange';
    return NextResponse.redirect(
      publicUrl(request, `/${locale}/?error=${errorCode}`, url.origin)
    );
  }

  const target = next ?? `/${locale}/logging`;
  return NextResponse.redirect(publicUrl(request, target, url.origin));
}

export async function GET(request: NextRequest) {
  return handleAuthCallback(request);
}
