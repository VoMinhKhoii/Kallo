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
vi.mock('@/i18n/routing', () => ({ routing: { locales: ['en'] } }));
vi.mock('@/lib/infra/supabase/middleware', () => ({
  updateSession: async (_request: NextRequest, response: NextResponse) =>
    response,
}));

const consoleError = vi
  .spyOn(console, 'error')
  .mockImplementation(() => undefined);

const { proxy } = await import('@/proxy');

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

    const res = await proxy(
      request('/api/healthz', {
        'x-origin-verify': 'topsecret',
      })
    );

    expect(res.status).toBe(200);
  });

  it('rejects a request that did not come through Cloudflare', async () => {
    vi.stubEnv('ORIGIN_SHARED_SECRET', 'topsecret');

    expect((await proxy(request())).status).toBe(403);
    expect(
      (await proxy(request('/api/healthz', { 'x-origin-verify': 'wrong' })))
        .status
    ).toBe(403);
  });

  // Failing OPEN here meant a deployed revision with a missing secret binding
  // served the whole internet with its edge WAF bypassable, and said nothing.
  it('refuses to serve on Cloud Run when the secret is unset', async () => {
    vi.stubEnv('ORIGIN_SHARED_SECRET', '');
    vi.stubEnv('K_SERVICE', 'kallo-prod');

    const res = await proxy(request());

    expect(res.status).toBe(503);
    expect(await res.text()).toBe('Origin lock misconfigured');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('ORIGIN_SHARED_SECRET is unset on Cloud Run')
    );
  });

  it('skips the lock entirely off Cloud Run, so local dev still works', async () => {
    vi.stubEnv('ORIGIN_SHARED_SECRET', '');
    vi.stubEnv('K_SERVICE', '');

    const res = await proxy(request());

    expect(res.status).toBe(200);
    expect(consoleError).not.toHaveBeenCalled();
  });
});

// The CSP is enforced statically from next.config.ts `headers()` (see
// __tests__/next-config.test.ts), not here: prerendered shells cannot carry a
// per-request nonce, so the proxy no longer mints one or sets any CSP.
describe('page responses', () => {
  function pageRequest(path: string) {
    return request(path, { accept: 'text/html' });
  }

  it('sets no CSP of its own and leaves no nonce on the request', async () => {
    vi.stubEnv('ORIGIN_SHARED_SECRET', '');
    vi.stubEnv('K_SERVICE', '');
    const req = pageRequest('/en/docs/overview');

    const res = await proxy(req);

    expect(res.status).toBe(200);
    // A proxy-set header would sit beside the next.config one and the
    // browser would enforce BOTH — the stricter nonce one refusing every
    // framework chunk of the static shell.
    expect(res.headers.get('content-security-policy')).toBeNull();
    expect(res.headers.get('content-security-policy-report-only')).toBeNull();
    expect(req.headers.get('x-nonce')).toBeNull();
    expect(req.headers.get('content-security-policy')).toBeNull();
  });

  // Browsers POST violation reports without cookies; the collector must get
  // through the proxy like any other /api route — no locale rewrite, no
  // session work — and stay behind the origin lock.
  it('passes CSP reports straight through, still origin-locked', async () => {
    vi.stubEnv('ORIGIN_SHARED_SECRET', 'topsecret');

    expect((await proxy(request('/api/csp-report'))).status).toBe(403);
    const res = await proxy(
      request('/api/csp-report', { 'x-origin-verify': 'topsecret' })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('advertises the Markdown sibling of a docs page', async () => {
    vi.stubEnv('ORIGIN_SHARED_SECRET', '');
    vi.stubEnv('K_SERVICE', '');

    const res = await proxy(pageRequest('/en/docs/overview'));

    expect(res.headers.get('link')).toContain('type="text/markdown"');
  });

  it('leaves skip-listed paths without locale handling', async () => {
    vi.stubEnv('ORIGIN_SHARED_SECRET', '');
    vi.stubEnv('K_SERVICE', '');

    const res = await proxy(pageRequest('/openapi.json'));

    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });
});
