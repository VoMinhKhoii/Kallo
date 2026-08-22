import { type NextRequest, NextResponse } from 'next/server';
import { isDuplicateEmailError } from '@/lib/infra/auth/duplicate-email';
import { localeFromNext, publicUrl } from '@/lib/infra/auth/redirects';
import { safeNextPath } from '@/lib/infra/auth/safe-next';
import { createClient } from '@/lib/infra/supabase/server';

export const runtime = 'nodejs';

/**
 * Re-exported for the migration-contract test in `route.test.ts`. The constant
 * itself lives in `lib/auth/duplicate-email.ts` so the browser ID-token flow
 * can share it without importing a route module.
 */
export { DUPLICATE_EMAIL_MARKER } from '@/lib/infra/auth/duplicate-email';

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
      const errorCode = isDuplicateEmailError(providerErrorDescription)
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
    const errorCode = isDuplicateEmailError(error.message)
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
