import type { NextRequest } from 'next/server';
import {
  type WaitlistSignupResponse,
  waitlistSignupSchema,
} from '@/lib/api/contracts/waitlist';
import { handleRouteError } from '@/lib/api/respond';
import { signUpForWaitlist } from '@/lib/domain/waitlist/signup';
import { getRequestIp } from '@/lib/infra/security/request-ip';

export const runtime = 'nodejs';

/**
 * Join the landing-page waitlist (double opt-in — this only sends the
 * confirmation email; `/api/v1/waitlist/confirm` is what adds someone).
 *
 * A route handler rather than a Server Action because the caller is
 * unauthenticated and the rate limiter needs the request's IP.
 *
 * The success body is always the same. Whether the address was new, already
 * pending, or already confirmed is not something a stranger gets to learn.
 */
export async function POST(req: NextRequest) {
  try {
    const body = waitlistSignupSchema.parse(await req.json());
    await signUpForWaitlist(body, { ip: getRequestIp(req) });
    return Response.json({ ok: true } satisfies WaitlistSignupResponse);
  } catch (error) {
    return handleRouteError(error);
  }
}
