import {
  RateLimitedError,
  RateLimitUnavailableError,
} from '@/lib/core/errors/app-error';
import { hasValidRefreshToken, parseAuthBody } from './auth-body';
import { classifyAuthRequest } from './auth-path-policy';
import { enforceAuthProxyLimits } from './enforce-limits';
import {
  limiterUnavailableResponse,
  rateLimitedResponse,
  validationFailedResponse,
} from './gotrue-error';

/**
 * Everything that has to be true before an auth request is forwarded.
 *
 * One function so the route stays a proxy: classify, refuse what we cannot
 * key, consume the budgets, and translate a refusal into the dialect the
 * calling client understands. Returns `null` when the request may proceed and
 * a ready `Response` when it may not — nothing here ever touches upstream.
 */

export interface GuardAuthRequestInput {
  method: string;
  /** Upstream pathname with `/auth/v1/` already stripped. */
  path: string;
  grantType: string | null;
  /** The bounded body bytes, or `undefined` for a bodyless method. */
  body: Uint8Array | undefined;
}

export async function guardAuthRequest(
  request: Request,
  input: GuardAuthRequestInput
): Promise<Response | null> {
  const classification = classifyAuthRequest({
    method: input.method,
    path: input.path,
    grantType: input.grantType,
    body: parseAuthBody(input.body),
  });

  // A refresh we cannot read is a refresh we cannot forward: it would spend the
  // shared upstream bucket every proxied user depends on, and it cannot be what
  // a real client sent. Refused locally, in the envelope GoTrue would use.
  if (classification.op === 'refresh' && !hasValidRefreshToken(input.body)) {
    return validationFailedResponse('refresh_token is required');
  }

  // Fail closed on the ops whose only real control is the target key. See
  // `requiresTarget` — forwarding an unkeyed signup or recover is precisely the
  // mail bomb the per-recipient budget exists to stop.
  if (classification.requiresTarget && !classification.targetKey) {
    return validationFailedResponse('email or phone is required');
  }

  try {
    await enforceAuthProxyLimits(request, classification);
  } catch (error) {
    if (error instanceof RateLimitedError) {
      // A 429 on token refresh SIGNS THE USER OUT. Both clients call
      // `_removeSession()` / `_callRefreshToken`'s error path on any
      // non-retryable failure, and only the network codes (502-504, 520-524,
      // 530 in auth-js's `handleError`) are retryable. So a refusal on the one
      // request that keeps a session alive is spoken as 503: the client backs
      // off and KEEPS the session, which is what "slow down" has to mean here.
      return classification.op === 'refresh'
        ? limiterUnavailableResponse(error.retryAfterSeconds)
        : rateLimitedResponse(error.retryAfterSeconds);
    }
    if (error instanceof RateLimitUnavailableError) {
      return limiterUnavailableResponse(error.retryAfterSeconds);
    }
    throw error;
  }

  return null;
}
