import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The origin lock is the app's only trust boundary, so its three states are
 * worth pinning: enforced, misconfigured, and deliberately off.
 *
 * Everything downstream of the lock (next-intl, the Supabase session refresh)
 * is mocked to a pass-through — this file is about which requests get past the
 * gate, not about what happens after.
 */

vi.mock('next-intl/middleware', () => ({
  default: () => () => NextResponse.next(),
}));
vi.mock('@/i18n/navigation', () => ({ routing: { locales: ['en'] } }));
vi.mock('@/lib/infra/supabase/middleware', () => ({
  updateSession: async (_request: NextRequest, response: NextResponse) =>
    response,
}));

const consoleError = vi
  .spyOn(console, 'error')
  .mockImplementation(() => undefined);

const { middleware } = await import('@/middleware');

function request(path = '/api/healthz', headers: Record<string, string> = {}) {
  const url = new URL(`https://kallo.fit${path}`);
  const req = new Request(url, { headers }) as unknown as { nextUrl?: URL };
  req.nextUrl = url;
  return req as unknown as NextRequest;
}

afterEach(() => {
  vi.unstubAllEnvs();
  consoleError.mockClear();
});

describe('origin lock', () => {
  it('passes a request carrying the shared secret', async () => {
    vi.stubEnv('ORIGIN_SHARED_SECRET', 'topsecret');

    const res = await middleware(
      request('/api/healthz', {
        'x-origin-verify': 'topsecret',
      })
    );

    expect(res.status).toBe(200);
  });

  it('rejects a request that did not come through Cloudflare', async () => {
    vi.stubEnv('ORIGIN_SHARED_SECRET', 'topsecret');

    expect((await middleware(request())).status).toBe(403);
    expect(
      (
        await middleware(
          request('/api/healthz', { 'x-origin-verify': 'wrong' })
        )
      ).status
    ).toBe(403);
  });

  // Failing OPEN here meant a deployed revision with a missing secret binding
  // served the whole internet with its edge WAF bypassable, and said nothing.
  it('refuses to serve on Cloud Run when the secret is unset', async () => {
    vi.stubEnv('ORIGIN_SHARED_SECRET', '');
    vi.stubEnv('K_SERVICE', 'kallo-prod');

    const res = await middleware(request());

    expect(res.status).toBe(503);
    expect(await res.text()).toBe('Origin lock misconfigured');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('ORIGIN_SHARED_SECRET is unset on Cloud Run')
    );
  });

  it('skips the lock entirely off Cloud Run, so local dev still works', async () => {
    vi.stubEnv('ORIGIN_SHARED_SECRET', '');
    vi.stubEnv('K_SERVICE', '');

    const res = await middleware(request());

    expect(res.status).toBe(200);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
