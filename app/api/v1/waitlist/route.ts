import type { NextRequest } from 'next/server';
import {
  type WaitlistSignupResponse,
  waitlistSignupSchema,
} from '@/lib/api/contracts/waitlist';
import { handleRouteError } from '@/lib/api/respond';
import { signUpForWaitlist } from '@/lib/domain/waitlist/signup';
import { readBoundedJson } from '@/lib/infra/http/bounded-body';
import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';
import { getRequestIp } from '@/lib/infra/security/request-ip';

export const runtime = 'nodejs';

/** An address, a locale and a source. 8 KB is already absurdly generous. */
const MAX_BODY_BYTES = 8 * 1024;

/**
 * Join the landing-page waitlist (double opt-in — this only sends the
 * confirmation email; `/api/v1/waitlist/confirm` is what adds someone).
 *
 * A route handler rather than a Server Action because the caller is
 * unauthenticated and the rate limiter needs the request's IP.
 *
 * Three ceilings. `waitlistGlobal` is the app-wide backstop and runs ALWAYS,
 * so a null-IP flood of distinct addresses is still bounded. The per-IP policy
 * is the flood control, skipped only when there is no IP to key on (production
 * returns `null` whenever `cf-connecting-ip` is absent). The per-address
 * cooldown inside `signUpForWaitlist` is the mail-bombing control for one
 * address. Global first, then IP: cheapest rejection first.
 *
 * The success body is always the same. Whether the address was new, already
 * pending, or already confirmed is not something a stranger gets to learn.
 */
export async function POST(req: NextRequest) {
  try {
    const body = waitlistSignupSchema.parse(
      await readBoundedJson(req, MAX_BODY_BYTES)
    );

    const ip = getRequestIp(req);
    await assertRateLimit('waitlistGlobal', {
      kind: 'global',
      value: 'waitlist',
    });
    if (ip)
      await assertRateLimit('waitlistSignupIp', { kind: 'ip', value: ip });

    await signUpForWaitlist(body, { ip });
    return Response.json({ ok: true } satisfies WaitlistSignupResponse);
  } catch (error) {
    return handleRouteError(error);
  }
}
