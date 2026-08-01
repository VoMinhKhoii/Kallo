import { type NextRequest, NextResponse } from 'next/server';
import { publicUrl } from '@/lib/auth/redirects';
import { confirmWaitlistSignup } from '@/lib/waitlist/confirm';

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
 * Lives under `/api` so `middleware.ts` skips the next-intl locale rewrite; the
 * locale for the redirect comes from the stored row instead.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  const { status, locale } = await confirmWaitlistSignup(token);

  return NextResponse.redirect(
    publicUrl(request, `/${locale}/?waitlist=${status}`, request.nextUrl.origin)
  );
}
