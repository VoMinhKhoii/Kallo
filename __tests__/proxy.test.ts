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

// The rename from middleware.ts to proxy.ts (Next 16) must not change what a
// page response carries. The CSP stays Report-Only until it is enforced in a
// separate change, and the nonce still reaches the render on the request.
describe('page responses', () => {
  function pageRequest(path: string) {
    return request(path, { accept: 'text/html' });
  }

  it('sends the CSP as Report-Only, never enforced', async () => {
    vi.stubEnv('ORIGIN_SHARED_SECRET', '');
    vi.stubEnv('K_SERVICE', '');

    const res = await proxy(pageRequest('/en/docs/overview'));

    const csp = res.headers.get('content-security-policy-report-only');
    expect(csp).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/);
    expect(res.headers.get('content-security-policy')).toBeNull();
  });

  it('puts the same nonce on the request the render reads', async () => {
    vi.stubEnv('ORIGIN_SHARED_SECRET', '');
    vi.stubEnv('K_SERVICE', '');
    const req = pageRequest('/en');

    const res = await proxy(req);

    const nonce = req.headers.get('x-nonce');
    expect(nonce).toBeTruthy();
    expect(req.headers.get('content-security-policy')).toContain(
      `'nonce-${nonce}'`
    );
    expect(res.headers.get('content-security-policy-report-only')).toContain(
      `'nonce-${nonce}'`
    );
  });

  it('advertises the Markdown sibling of a docs page', async () => {
    vi.stubEnv('ORIGIN_SHARED_SECRET', '');
    vi.stubEnv('K_SERVICE', '');

    const res = await proxy(pageRequest('/en/docs/overview'));

    expect(res.headers.get('link')).toContain('type="text/markdown"');
  });

  it('leaves skip-listed paths without a CSP or locale handling', async () => {
    vi.stubEnv('ORIGIN_SHARED_SECRET', '');
    vi.stubEnv('K_SERVICE', '');

    const res = await proxy(pageRequest('/openapi.json'));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy-report-only')).toBeNull();
  });
});
