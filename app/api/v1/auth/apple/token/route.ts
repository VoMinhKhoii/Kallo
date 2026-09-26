import type { NextRequest } from 'next/server';
import { readJsonBody, requireUser } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';
import { Errors } from '@/lib/core/errors/catalog';
import {
  appleSubjectOf,
  appleTokenLinkBodySchema,
} from '@/lib/domain/apple-sign-in/contracts';
import { linkAppleAuthorizationCode } from '@/lib/domain/apple-sign-in/refresh-tokens';
import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';

/**
 * `POST /api/v1/auth/apple/token` — the iOS app posts the authorization code
 * from a native Sign in with Apple right after signing in. We exchange it for
 * a refresh token and keep that sealed, so deleting the account can revoke
 * the user's Apple authorization (Apple's account-deletion requirement).
 *
 * `{ stored: false }` means this deployment has no Apple credentials; the
 * client treats every outcome as fire-and-forget and never blocks sign-in.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    await assertRateLimit('appleTokenLink', { kind: 'user', value: user.id });
    const body = appleTokenLinkBodySchema.parse(await readJsonBody(request));

    const appleSubject = appleSubjectOf(user.identities);
    if (!appleSubject) {
      throw Errors.conflict('This account has no linked Apple identity.');
    }
    const outcome = await linkAppleAuthorizationCode({
      userId: user.id,
      appleSubject,
      authorizationCode: body.authorizationCode,
    });
    return Response.json({ stored: outcome === 'stored' });
  } catch (error) {
    return handleRouteError(error);
  }
}
