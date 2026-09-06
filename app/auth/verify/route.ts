import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { RateLimitedError } from '@/lib/core/errors/app-error';
import { localeFromNext, publicUrl } from '@/lib/infra/auth/redirects';
import { safeNextPath } from '@/lib/infra/auth/safe-next';
import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';
import { getRequestIp } from '@/lib/infra/security/request-ip';
import { createClient } from '@/lib/infra/supabase/server';

export const runtime = 'nodejs';

/**
 * Server-side handler for emailed auth links (signup confirmation, password
 * recovery, magic link, email change).
 *
 * Supabase's hosted GoTrue would otherwise link the browser straight to
 * `<project>.supabase.co/auth/v1/verify`, which is unreachable on the VN
 * networks that blackhole the supabase.co Cloudflare edge — the same reason
 * `app/api/supabase-proxy` exists, and the reason emailed links were the one
 * auth leg the proxy couldn't cover. We instead template the emails to point at
 * this route with `{{ .TokenHash }}` and verify the token from Cloud Run (whose
 * egress to Supabase is unaffected), establishing the session via cookies
 * before redirecting into the app.
 *
 * Requires the Supabase email templates + redirect allow-list to be updated —
 * see `.tuturuuu/tasks/supabase-email-links-bypass-auth-proxy.md`.
 */

// Params of an emailed token_hash link. The active templates emit `type=email`
// (signup confirmation + magic link), `type=recovery` (password reset), and
// `type=email_change`; GoTrue's deprecated `signup`/`magiclink` aliases and the
// legacy `token`+`email` (non-hash) flow are intentionally not accepted.
const VerifyParams = z.object({
  token_hash: z.string().min(1),
  type: z.enum(['email', 'recovery', 'email_change']),
});

type VerifyType = z.infer<typeof VerifyParams>['type'];

/** Landing target after a successful verify when the email carried no explicit
 * (safe) `next`. Recovery must reach the password-reset screen; every other
 * type is a completed login. */
function defaultTargetFor(type: VerifyType, locale: string): string {
  return type === 'recovery'
    ? `/${locale}/reset-password`
    : `/${locale}/logging`;
}

/**
 * Verifies the emailed token and computes the redirect. Exported as a plain
 * helper so tests can inject a mocked Supabase client (Next reserves the second
 * positional `GET` parameter for its `RouteContext`).
 */
export async function handleVerify(
  request: NextRequest,
  deps?: { supabase?: Awaited<ReturnType<typeof createClient>> }
): Promise<NextResponse> {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get('next'));
  const locale = localeFromNext(next);

  const params = VerifyParams.safeParse({
    token_hash: url.searchParams.get('token_hash'),
    type: url.searchParams.get('type'),
  });
  if (!params.success) {
    return NextResponse.redirect(
      publicUrl(request, `/${locale}/?error=verify_failed`, url.origin)
    );
  }
  const { token_hash, type } = params.data;

  // Anonymous, and it calls GoTrue for us: an unbounded flood of guessed
  // `token_hash` values spends the app's SHARED per-IP `token_verifications`
  // budget upstream (every proxied user reaches Supabase through one Cloud Run
  // egress address). Charged only for links that would really reach GoTrue, and
  // only when an IP key exists — `getRequestIp` returns null in production
  // whenever the request did not come through Cloudflare, and a policy applied
  // with no key counts nothing.
  const ip = getRequestIp(request);
  if (ip) {
    try {
      await assertRateLimit('authLinkIp', { kind: 'ip', value: ip });
    } catch (error) {
      if (!(error instanceof RateLimitedError)) throw error;
      // This is a browser navigation, not an API call. A 429 JSON envelope
      // would render as raw text in the address bar; the user gets the same
      // "that link did not work" screen a failed verify already produces.
      return NextResponse.redirect(
        publicUrl(request, `/${locale}/?error=verify_failed`, url.origin)
      );
    }
  }

  const supabase = deps?.supabase ?? (await createClient());
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    console.error('[auth/verify] verifyOtp failed:', error.message);
    return NextResponse.redirect(
      publicUrl(request, `/${locale}/?error=verify_failed`, url.origin)
    );
  }

  const target = next ?? defaultTargetFor(type, locale);
  return NextResponse.redirect(publicUrl(request, target, url.origin));
}

export async function GET(request: NextRequest) {
  return handleVerify(request);
}
