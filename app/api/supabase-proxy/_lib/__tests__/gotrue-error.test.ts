import { describe, expect, it } from 'vitest';
import {
  limiterUnavailableResponse,
  payloadTooLargeResponse,
  rateLimitedResponse,
} from '@/app/api/supabase-proxy/_lib/gotrue-error';

/**
 * These assertions encode `@supabase/auth-js`'s `handleError`: the error code
 * is read from `error_code` (because `code` holds the numeric status, which
 * fails its `typeof === 'string'` check), and the message from `msg`. If the
 * shape drifts, both clients fall back to their generic error copy — which
 * looks like a working proxy and reads to the user as a broken app.
 */

/** What supabase-js would extract from one of these bodies. */
function parseLikeAuthJs(data: Record<string, unknown>) {
  const errorCode =
    typeof data.code === 'string' ? data.code : (data.error_code as string);
  const message =
    (data.msg as string) ??
    (data.message as string) ??
    (data.error_description as string) ??
    (data.error as string);
  return { errorCode, message };
}

describe('rateLimitedResponse', () => {
  it('is a 429 supabase-js reads as over_request_rate_limit', async () => {
    const res = rateLimitedResponse(37);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('37');
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(body).toEqual({
      code: 429,
      error_code: 'over_request_rate_limit',
      msg: 'Request rate limit reached',
    });
    expect(parseLikeAuthJs(body).errorCode).toBe('over_request_rate_limit');
    expect(parseLikeAuthJs(body).message).toBe('Request rate limit reached');
  });

  it('omits Retry-After when no wait is known', () => {
    expect(rateLimitedResponse().headers.get('retry-after')).toBeNull();
  });
});

describe('limiterUnavailableResponse', () => {
  it('is a 503 carrying its own Retry-After', async () => {
    const res = limiterUnavailableResponse(10);

    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('10');
    expect(await res.json()).toEqual({
      code: 503,
      error_code: 'service_unavailable',
      msg: 'Authentication is temporarily unavailable',
    });
  });
});

describe('payloadTooLargeResponse', () => {
  it('is a 413 with no Retry-After — the same bytes will fail again', async () => {
    const res = payloadTooLargeResponse();

    expect(res.status).toBe(413);
    expect(res.headers.get('retry-after')).toBeNull();
    expect(await res.json()).toEqual({
      code: 413,
      error_code: 'payload_too_large',
      msg: 'Request body is too large',
    });
  });
});
