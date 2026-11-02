import type { NextRequest } from 'next/server';
import {
  type WaitlistSignupResponse,
  waitlistSignupSchema,
} from '@/lib/api/contracts/waitlist';
import { handleRouteError } from '@/lib/api/respond';
import { canonicalizeEmailForKey } from '@/lib/core/text/email';
import { signUpForWaitlist } from '@/lib/domain/waitlist/signup';
import { readBoundedJson } from '@/lib/infra/http/bounded-body';
import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';
import { getRequestIp } from '@/lib/infra/security/request-ip';

/** An address, a locale and a source. 8 KB is already absurdly generous. */
const MAX_BODY_BYTES = 8 * 1024;

/**
 * Join the landing-page waitlist (double opt-in — this only sends the
 * confirmation email; `/api/v1/waitlist/confirm` is what adds someone).
 *
 * A route handler rather than a Server Action because the caller is
 * unauthenticated and the rate limiter needs the request's IP.
 *
 * `waitlistGlobal` is the app-wide backstop, including when
 * there is no IP. The per-IP policy runs first and
 * is the flood control, skipped only when there is no IP to key on (production
 * returns `null` whenever `cf-connecting-ip` is absent). The canonical mailbox
 * policy follows global admission; the domain also enforces its rolling
 * cooldown. IP refusals never spend the shared global or recipient budgets.
 *
 * The body is read BEFORE the limiters, deliberately. It is capped at 8 KB and
 * parsed in memory, while each limiter charge is a database round trip, so a
 * junk or oversized body is refused (400 / 413) without touching the database
 * at all. A valid body then pays the limiters before any real work. On a
 * protected route the analogue is "authenticate first"; here there is no
 * identity to check, so the cheapest refusal goes first instead.
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
    if (ip)
      await assertRateLimit('waitlistSignupIp', { kind: 'ip', value: ip });
    await assertRateLimit('waitlistGlobal', {
      kind: 'global',
      value: 'waitlist',
    });
    await assertRateLimit('waitlistSignupRecipient', {
      kind: 'recipient',
      value: canonicalizeEmailForKey(body.email),
    });

    await signUpForWaitlist(body, { ip });
    return Response.json({ ok: true } satisfies WaitlistSignupResponse);
  } catch (error) {
    return handleRouteError(error);
  }
}
