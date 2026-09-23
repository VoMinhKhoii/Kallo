import type { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// KALLO-11 regressions: the path canonicalization and the upstream `Location`
// rewrite, exercised through the real route handler. Split from route.test.ts,
// which covers forwarding and rate limiting.

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');

const assertRateLimit = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({
  assertRateLimit: (...args: unknown[]) => assertRateLimit(...args),
}));

vi.spyOn(console, 'error').mockImplementation(() => undefined);

const { GET, POST } = await import('@/app/api/supabase-proxy/[...path]/route');

/**
 * A request as the route receives it: `segments` is Next's catch-all param
 * AFTER its single percent-decode, `search` the raw query string.
 */
function makeRequest(
  segments: string[],
  {
    search = '',
    method = 'GET',
    body,
  }: {
    search?: string;
    method?: string;
    body?: string;
  } = {}
): { req: NextRequest; params: { params: Promise<{ path: string[] }> } } {
  const url = new URL(`http://localhost/api/supabase-proxy/x${search}`);
  const req = new Request(url, {
    method,
    body,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.9',
    },
  }) as unknown as { nextUrl?: URL };
  req.nextUrl = url;
  return {
    req: req as unknown as NextRequest,
    params: { params: Promise.resolve({ path: segments }) },
  };
}

const split = (path: string) => path.split('/');

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }));
  assertRateLimit.mockReset();
  assertRateLimit.mockResolvedValue(undefined);
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('supabase-proxy path canonicalization (KALLO-11)', () => {
  it.each([
    // The pentest escape: `..%252F..%252Frest` on the wire, which Next hands
    // over as `..%2F..%2Frest` and Supabase's gateway would decode again.
    'auth/v1/..%2F..%2Frest/v1/user_profiles',
    'auth/v1/token/..%2F..%2F..%2Frest/v1/user_profiles',
    'auth/v1/%2e%2e/%2e%2e/rest/v1/user_profiles',
    'auth/v1/%252e%252e/%252e%252e/rest/v1/user_profiles',
    'auth/v1/%2E%2E%2F%2E%2E%2Frest/v1/user_profiles',
    'auth/v1/to%6Ben',
    'auth/v1/token;/../../rest/v1',
    'auth/v1/token;foo',
    'auth/v1/..;/..;/rest/v1/user_profiles',
    'auth/v1/..\\..\\rest/v1/user_profiles',
    'AUTH/V1/token',
    'auth/V1/token',
    'auth/v1/ADMIN/users',
    'auth/v1/Admin',
    'auth/v1/Invite',
    'auth/v1//token',
    'auth/v1/',
    'auth/v1/token\u0000',
    'auth/v1/tok\ren',
    'auth/v1/token ',
  ])('refuses %j with 404 and never contacts upstream', async (path) => {
    const { req, params } = makeRequest(split(path), { method: 'POST' });
    const res = await POST(req, params);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a segment Next decoded into a literal slash', async () => {
    // `auth/v1/..%2F..%2Frest` single-encoded: Next yields `../../rest`.
    const { req, params } = makeRequest(['auth', 'v1', '../../rest', 'v1']);
    const res = await GET(req, params);

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  const FACTOR = '0f8fad5b-d9cb-469f-a165-70867728950e';

  it.each([
    [
      'POST',
      'auth/v1/token',
      '?grant_type=password',
      '{"email":"a@b.co","password":"x"}',
    ],
    [
      'POST',
      'auth/v1/token',
      '?grant_type=refresh_token',
      '{"refresh_token":"abc"}',
    ],
    ['GET', 'auth/v1/user', '', undefined],
    ['POST', 'auth/v1/logout', '?scope=global', undefined],
    ['POST', 'auth/v1/verify', '', '{"type":"email","token_hash":"h"}'],
    [
      'GET',
      'auth/v1/authorize',
      '?provider=google&redirect_to=https%3A%2F%2Fkallo.fit%2Fauth%2Fcallback',
      undefined,
    ],
    ['POST', 'auth/v1/otp', '', '{"email":"a@b.co"}'],
    ['POST', 'auth/v1/recover', '', '{"email":"a@b.co"}'],
    ['POST', 'auth/v1/signup', '', '{"email":"a@b.co","password":"x"}'],
    ['GET', 'auth/v1/settings', '', undefined],
    ['GET', 'auth/v1/factors', '', undefined],
    ['POST', `auth/v1/factors/${FACTOR}/challenge`, '', '{}'],
    ['POST', `auth/v1/factors/${FACTOR}/verify`, '', '{"code":"123456"}'],
    ['GET', 'auth/v1/.well-known/jwks.json', '', undefined],
  ])('forwards %s %s%s to the exact upstream URL', async (method, path, search, body) => {
    const handler = method === 'GET' ? GET : POST;
    const { req, params } = makeRequest(split(path), { search, method, body });
    const res = await handler(req, params);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      `https://project.supabase.co/${path}${search}`
    );
  });
});

describe('supabase-proxy upstream Location rewrite', () => {
  function redirectTo(location: string, status = 302) {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status, headers: { location } })
    );
  }

  const authorize = () =>
    makeRequest(split('auth/v1/authorize'), { search: '?provider=google' });

  it('passes the OAuth hop to Google through byte for byte', async () => {
    const google =
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&redirect_uri=https%3A%2F%2Fproject.supabase.co%2Fauth%2Fv1%2Fcallback&state=s';
    redirectTo(google);
    const { req, params } = authorize();
    const res = await GET(req, params);

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(google);
  });

  it('moves a Supabase auth target onto the same-origin proxy path', async () => {
    redirectTo(
      'https://project.supabase.co/auth/v1/callback?error=access_denied'
    );
    const { req, params } = authorize();
    const res = await GET(req, params);

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      '/api/supabase-proxy/auth/v1/callback?error=access_denied'
    );
  });

  it.each([
    'https://kallo-prod-abc123-as.a.run.app/en/logging',
    'https://project.supabase.co/rest/v1/user_profiles',
    '/rest/v1/user_profiles',
  ])('refuses a redirect to %s with a 502 and no Location', async (location) => {
    redirectTo(location);
    const { req, params } = authorize();
    const res = await GET(req, params);

    expect(res.status).toBe(502);
    expect(res.headers.get('location')).toBeNull();
    expect(await res.json()).toEqual({ error: 'upstream_redirect_refused' });
  });

  it('strips a refused Location from a non-redirect response', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{}', {
        status: 200,
        headers: { location: 'https://kallo-prod-abc123-as.a.run.app/' },
      })
    );
    const { req, params } = makeRequest(split('auth/v1/user'));
    const res = await GET(req, params);

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});
