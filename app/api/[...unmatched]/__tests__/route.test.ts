import { describe, expect, it } from 'vitest';
import {
  DELETE,
  GET,
  HEAD,
  OPTIONS,
  PATCH,
  POST,
  PUT,
} from '@/app/api/[...unmatched]/route';

const HANDLERS = [
  ['GET', GET],
  ['POST', POST],
  ['PUT', PUT],
  ['PATCH', PATCH],
  ['DELETE', DELETE],
  ['HEAD', HEAD],
  ['OPTIONS', OPTIONS],
] as const;

describe('the /api catch-all', () => {
  it('answers every method with a JSON 404, never HTML', async () => {
    // The defect this closes: an unmatched /api path fell through to Next's
    // HTML 404, so a client that mistyped an endpoint got markup where every
    // other response on /api is JSON.
    for (const [method, handler] of HANDLERS) {
      const response = await handler(
        new Request('https://kallo.fit/api/v1/nope', { method })
      );
      expect(response.status, method).toBe(404);
      expect(response.headers.get('content-type'), method).toContain(
        'application/json'
      );
    }
  });

  it('uses the same error envelope as every other endpoint', async () => {
    const response = await GET(new Request('https://kallo.fit/api/v1/nope'));
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'NOT_FOUND',
        status: 404,
        retryable: false,
        message: expect.stringContaining('/api/v1/nope'),
      },
    });
  });

  it('points the caller at the spec', async () => {
    const response = await POST(
      new Request('https://kallo.fit/api/typo', { method: 'POST' })
    );
    const body = await response.json();
    expect(body.error.message).toContain('/openapi.json');
  });
});
