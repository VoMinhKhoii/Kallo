import { type NextRequest, NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/api/respond';
import { confirmWaitlistSignup } from '@/lib/domain/waitlist/confirm';
import { publicUrl } from '@/lib/infra/auth/redirects';
import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';
import { getRequestIp } from '@/lib/infra/security/request-ip';

export const runtime = 'nodejs';

/**
 * Confirm a waitlist signup from the emailed link.
 *
 * Always redirects to the landing page with `?waitlist=<status>` rather than
 * rendering anything: the reader arrived from an email client, so the useful
 * end state is the site with a toast, not a bare JSON body. Every outcome —
 * confirmed, already-confirmed, expired, unknown token — lands the same way,
 * which also keeps a guessed token from being distinguishable by response
 * shape.
 *
 * The IP limit is what stops that uniformity from becoming a free token
 * oracle: identical responses mean guessing costs nothing to interpret, so the
 * cost has to be on the guessing itself. Skipped when there is no usable IP —
 * but `waitlistGlobal` runs ALWAYS, so a null-IP guessing flood is still capped
 * app-wide. Global first, then IP.
 *
 * Lives under `/api` so `middleware.ts` skips the next-intl locale rewrite; the
 * locale for the redirect comes from the stored row instead.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getRequestIp(request);
    await assertRateLimit('waitlistGlobal', {
      kind: 'global',
      value: 'waitlist-confirm',
    });
    if (ip)
      await assertRateLimit('waitlistConfirmIp', { kind: 'ip', value: ip });

    const token = request.nextUrl.searchParams.get('token') ?? '';
    const { status, locale } = await confirmWaitlistSignup(token);

    return NextResponse.redirect(
      publicUrl(
        request,
        `/${locale}/?waitlist=${status}`,
        request.nextUrl.origin
      )
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
