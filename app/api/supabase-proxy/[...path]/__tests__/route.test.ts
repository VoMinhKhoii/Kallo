import type { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Errors } from '@/lib/core/errors/catalog';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');

// The limiter is mocked, not exercised: what this route owes is the RIGHT
// policies with the RIGHT keys, in the right order, before the upstream fetch.
// Whether those policies then block is `lib/infra/rate-limit/limiter`'s test.
const assertRateLimit = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({
  assertRateLimit: (...args: unknown[]) => assertRateLimit(...args),
}));

const consoleError = vi
  .spyOn(console, 'error')
  .mockImplementation(() => undefined);

const { GET, POST, PUT } = await import(
  '@/app/api/supabase-proxy/[...path]/route'
);

/** The (policy, key) pairs the route consumed, in call order. */
function policyCalls() {
  return assertRateLimit.mock.calls as unknown as [
    string,
    { kind: string; value: string },
  ][];
}

function makeRequest(
  path: string,
  {
    method = 'GET',
    headers = {},
    body,
  }: { method?: string; headers?: Record<string, string>; body?: string } = {}
): { req: NextRequest; params: { params: Promise<{ path: string[] }> } } {
  const url = new URL(`http://localhost/api/supabase-proxy/${path}`);
  const [pathname] = path.split('?');
  const req = new Request(url, { method, headers, body }) as unknown as {
    nextUrl?: URL;
  };
  req.nextUrl = url;
  return {
    req: req as unknown as NextRequest,
    params: { params: Promise.resolve({ path: pathname.split('/') }) },
  };
}

function upstreamResponse(
  body: string,
  init: ResponseInit & { headers?: Record<string, string> } = {}
): Response {
  return new Response(body, init);
}

beforeEach(() => {
  fetchMock.mockReset();
  consoleError.mockClear();
  assertRateLimit.mockReset();
  assertRateLimit.mockResolvedValue(undefined);
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('supabase-proxy route', () => {
  it('forwards a token request with method, query, body, and allowlisted headers', async () => {
    fetchMock.mockResolvedValueOnce(
      upstreamResponse('{"access_token":"jwt"}', {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'content-encoding': 'gzip',
          'content-length': '999',
          'x-supabase-api-version': '2024-01-01',
        },
      })
    );

    const { req, params } = makeRequest(
      'auth/v1/token?grant_type=refresh_token',
      {
        method: 'POST',
        headers: {
          apikey: 'sb_publishable_key',
          authorization: 'Bearer jwt',
          'content-type': 'application/json',
          'x-client-info': 'supabase-flutter/2.10.0',
          cookie: 'secret=1',
        },
        body: '{"refresh_token":"abc"}',
      }
    );
    const res = await POST(req, params);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe(
      'https://project.supabase.co/auth/v1/token?grant_type=refresh_token'
    );
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('manual');
    const sentHeaders = init.headers as Headers;
    expect(sentHeaders.get('apikey')).toBe('sb_publishable_key');
    expect(sentHeaders.get('authorization')).toBe('Bearer jwt');
    expect(sentHeaders.get('x-client-info')).toBe('supabase-flutter/2.10.0');
    expect(sentHeaders.get('cookie')).toBeNull();
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe(
      '{"refresh_token":"abc"}'
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ access_token: 'jwt' });
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('x-supabase-api-version')).toBe('2024-01-01');
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(res.headers.get('content-length')).not.toBe('999');
  });

  it('sends no body for GET requests', async () => {
    fetchMock.mockResolvedValueOnce(
      upstreamResponse('{"name":"GoTrue"}', { status: 200 })
    );

    const { req, params } = makeRequest('auth/v1/health', {
      headers: { apikey: 'key' },
    });
    const res = await GET(req, params);

    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it.each([
    'rest/v1/user_profiles',
    'storage/v1/object/foo',
    'auth/v1/admin/users',
    // Admin-only: auth-js reaches /invite through GoTrueAdminApi, which needs
    // the service key no client of this proxy holds.
    'auth/v1/invite',
    'auth/v2/token',
    // Path-traversal escapes: `new URL()` collapses these `..` segments, so a
    // raw-string prefix check would forward them to /rest and the admin API.
    // Validating the RESOLVED pathname rejects them.
    'auth/v1/../../rest/v1/meals',
    'auth/v1/token/../admin/users',
    // Protocol-relative escape: resolves to a foreign origin, caught by the
    // origin check.
    '//evil.example/auth/v1/token',
  ])('rejects %s with 404 without contacting upstream', async (path) => {
    const { req, params } = makeRequest(path, { method: 'POST' });
    const res = await POST(req, params);

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes a 302 redirect through with its location header', async () => {
    fetchMock.mockResolvedValueOnce(
      upstreamResponse('', {
        status: 302,
        headers: { location: 'https://accounts.google.com/o/oauth2/auth?x=1' },
      })
    );

    const { req, params } = makeRequest('auth/v1/authorize?provider=google');
    const res = await GET(req, params);

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      'https://accounts.google.com/o/oauth2/auth?x=1'
    );
  });

  it('maps upstream fetch failures to 502', async () => {
    fetchMock.mockRejectedValueOnce(
      new DOMException('The operation timed out.', 'TimeoutError')
    );

    const { req, params } = makeRequest('auth/v1/token?grant_type=password', {
      method: 'POST',
      body: '{"email":"a@b.co","password":"x"}',
    });
    const res = await POST(req, params);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'upstream_unreachable' });
    expect(consoleError).toHaveBeenCalled();
  });
});

describe('supabase-proxy rate limiting', () => {
  const FROM_IP = { 'x-forwarded-for': '203.0.113.9' };

  beforeEach(() => {
    fetchMock.mockResolvedValue(upstreamResponse('{}', { status: 200 }));
  });

  it('charges global, IP and recipient for a mail-sending op, in that order', async () => {
    const { req, params } = makeRequest('auth/v1/recover', {
      method: 'POST',
      headers: { ...FROM_IP, 'content-type': 'application/json' },
      body: '{"email":"Victim@Example.COM"}',
    });

    await POST(req, params);

    expect(policyCalls()).toEqual([
      ['authGlobal', { kind: 'global', value: 'auth' }],
      ['authEmailIp', { kind: 'ip', value: '203.0.113.9' }],
      [
        'authEmailRecipient',
        { kind: 'recipient', value: 'victim@example.com' },
      ],
    ]);
  });

  it('charges the account key on a password grant', async () => {
    const { req, params } = makeRequest('auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { ...FROM_IP, 'content-type': 'application/json' },
      body: '{"email":"victim@example.com","password":"x"}',
    });

    await POST(req, params);

    expect(policyCalls()).toEqual([
      ['authGlobal', { kind: 'global', value: 'auth' }],
      ['authLoginIp', { kind: 'ip', value: '203.0.113.9' }],
      ['authLoginAccount', { kind: 'account', value: 'victim@example.com' }],
    ]);
  });

  it('charges the email-change on PUT /user as a mail-sending op', async () => {
    const { req, params } = makeRequest('auth/v1/user', {
      method: 'PUT',
      headers: { ...FROM_IP, 'content-type': 'application/json' },
      body: '{"email":"new@example.com"}',
    });

    await PUT(req, params);

    expect(policyCalls().map(([policy]) => policy)).toEqual([
      'authGlobal',
      'authEmailIp',
      'authEmailRecipient',
    ]);
  });

  it('charges the refresh global budget before the per-IP flood breaker', async () => {
    const { req, params } = makeRequest(
      'auth/v1/token?grant_type=refresh_token',
      {
        method: 'POST',
        headers: { ...FROM_IP, 'content-type': 'application/json' },
        body: '{"refresh_token":"abc"}',
      }
    );

    await POST(req, params);

    expect(policyCalls()).toEqual([
      ['authRefreshGlobal', { kind: 'global', value: 'auth:refresh' }],
      ['authRefresh', { kind: 'ip', value: '203.0.113.9' }],
    ]);
  });

  it('charges authOther for a read', async () => {
    const { req, params } = makeRequest('auth/v1/user', {
      headers: FROM_IP,
    });

    await GET(req, params);

    expect(policyCalls()).toEqual([
      ['authOther', { kind: 'ip', value: '203.0.113.9' }],
    ]);
  });

  // A request that arrives without a usable client address is not unlimited:
  // the app-wide budget is what stands between us and a botnet whose every request
  // looks unremarkable per key.
  it('still enforces the global budget when there is no client IP', async () => {
    const { req, params } = makeRequest('auth/v1/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"email":"victim@example.com","password":"x"}',
    });

    await POST(req, params);

    expect(policyCalls()).toEqual([
      ['authGlobal', { kind: 'global', value: 'auth' }],
      [
        'authEmailRecipient',
        { kind: 'recipient', value: 'victim@example.com' },
      ],
    ]);
  });

  // `authRefresh` accepts only an `ip` key, so calling it without one would
  // resolve NO key — which the limiter treats as a call-site bug and throws on
  // outside production. Skipping THAT call (but not the global one) is the
  // correct shape.
  it('still charges the refresh global budget with no client IP', async () => {
    const { req, params } = makeRequest(
      'auth/v1/token?grant_type=refresh_token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"refresh_token":"abc"}',
      }
    );

    const res = await POST(req, params);

    expect(policyCalls()).toEqual([
      ['authRefreshGlobal', { kind: 'global', value: 'auth:refresh' }],
    ]);
    expect(res.status).toBe(200);
  });

  it('answers a block in GoTrue’s envelope with Retry-After, before upstream', async () => {
    assertRateLimit.mockRejectedValueOnce(Errors.rateLimited(undefined, 42));

    const { req, params } = makeRequest('auth/v1/recover', {
      method: 'POST',
      headers: { ...FROM_IP, 'content-type': 'application/json' },
      body: '{"email":"victim@example.com"}',
    });
    const res = await POST(req, params);

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('42');
    expect(await res.json()).toEqual({
      code: 429,
      error_code: 'over_request_rate_limit',
      msg: 'Request rate limit reached',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers a fail-closed limiter outage with a 503 in the same envelope', async () => {
    assertRateLimit.mockRejectedValueOnce(Errors.rateLimiterUnavailable());

    const { req, params } = makeRequest('auth/v1/recover', {
      method: 'POST',
      headers: { ...FROM_IP, 'content-type': 'application/json' },
      body: '{"email":"victim@example.com"}',
    });
    const res = await POST(req, params);

    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('10');
    expect((await res.json()).error_code).toBe('service_unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses an oversized body with 413 before the limiter or upstream', async () => {
    const { req, params } = makeRequest('auth/v1/signup', {
      method: 'POST',
      headers: { ...FROM_IP, 'content-type': 'application/json' },
      body: `{"email":"a@b.co","password":"${'x'.repeat(64 * 1024)}"}`,
    });
    const res = await POST(req, params);

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      code: 413,
      error_code: 'payload_too_large',
      msg: 'Request body is too large',
    });
    expect(assertRateLimit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // GoTrue binds JSON keys case-insensitively, so this body mails a stranger
  // exactly like a lowercase one:
  //   curl -X POST '<proxy>/auth/v1/recover' -H 'content-type: application/json' \
  //        -d '{"Email":"victim@example.com"}'
  // Before the case-insensitive lookup this consumed no recipient budget at
  // all — the one control an attacker cannot escape by rotating IPs.
  it('charges the recipient budget for a capitalised Email key', async () => {
    const { req, params } = makeRequest('auth/v1/recover', {
      method: 'POST',
      headers: { ...FROM_IP, 'content-type': 'application/json' },
      body: '{"Email":"Victim+tag@Example.COM"}',
    });

    await POST(req, params);

    expect(policyCalls()).toEqual([
      ['authGlobal', { kind: 'global', value: 'auth' }],
      ['authEmailIp', { kind: 'ip', value: '203.0.113.9' }],
      [
        'authEmailRecipient',
        { kind: 'recipient', value: 'victim@example.com' },
      ],
    ]);
  });

  // Same bypass, one content-type over:
  //   curl -X POST '<proxy>/auth/v1/recover' \
  //        -H 'content-type: application/x-www-form-urlencoded' \
  //        -d 'email=victim%40example.com'
  it('charges the recipient budget for a form-encoded body', async () => {
    const { req, params } = makeRequest('auth/v1/recover', {
      method: 'POST',
      headers: {
        ...FROM_IP,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'email=victim%40example.com',
    });

    await POST(req, params);

    expect(policyCalls().at(-1)).toEqual([
      'authEmailRecipient',
      { kind: 'recipient', value: 'victim@example.com' },
    ]);
  });

  it('charges the email policies for GET /reauthenticate, which sends mail', async () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'user-1' })).toString(
      'base64url'
    );

    const { req, params } = makeRequest('auth/v1/reauthenticate', {
      headers: { ...FROM_IP, authorization: `Bearer h.${payload}.s` },
    });

    await GET(req, params);

    expect(policyCalls()).toEqual([
      ['authGlobal', { kind: 'global', value: 'auth' }],
      ['authEmailIp', { kind: 'ip', value: '203.0.113.9' }],
      ['authEmailRecipient', { kind: 'recipient', value: 'user:user-1' }],
    ]);
  });

  it('refuses a mail-sending op that names nobody, before the limiter', async () => {
    const { req, params } = makeRequest('auth/v1/recover', {
      method: 'POST',
      headers: { ...FROM_IP, 'content-type': 'application/json' },
      body: '{"email":{"toLowerCase":"nope"}}',
    });
    const res = await POST(req, params);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: 400,
      error_code: 'validation_failed',
      msg: 'email or phone is required',
    });
    expect(assertRateLimit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a password grant that names no account', async () => {
    const { req, params } = makeRequest('auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { ...FROM_IP, 'content-type': 'application/json' },
      body: '{"password":"x"}',
    });
    const res = await POST(req, params);

    expect(res.status).toBe(400);
    expect((await res.json()).error_code).toBe('validation_failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Junk aimed at ?grant_type=refresh_token must never reach Supabase: upstream
  // sees one IP for every proxied user, so it would burn a bucket they share.
  it.each([
    ['no token', '{}'],
    ['a form-encoded body', 'refresh_token=abc'],
    ['an over-long token', `{"refresh_token":"${'x'.repeat(2049)}"}`],
  ])('refuses a refresh with %s', async (_name, body) => {
    const { req, params } = makeRequest(
      'auth/v1/token?grant_type=refresh_token',
      { method: 'POST', headers: { ...FROM_IP }, body }
    );
    const res = await POST(req, params);

    expect(res.status).toBe(400);
    expect((await res.json()).error_code).toBe('validation_failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // A 429 here would SIGN THE USER OUT: supabase-js's `_callRefreshToken` and
  // supabase-flutter both `_removeSession()` on any non-retryable error, and
  // only auth-js's NETWORK_ERROR_CODES are retryable. 503 is one of them.
  it('answers a refresh refusal with a retryable 503, never a 429', async () => {
    const AUTH_JS_NETWORK_ERROR_CODES = [
      502, 503, 504, 520, 521, 522, 523, 524, 530,
    ];
    assertRateLimit.mockRejectedValueOnce(Errors.rateLimited(undefined, 30));

    const { req, params } = makeRequest(
      'auth/v1/token?grant_type=refresh_token',
      {
        method: 'POST',
        headers: { ...FROM_IP, 'content-type': 'application/json' },
        body: '{"refresh_token":"abc"}',
      }
    );
    const res = await POST(req, params);

    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('30');
    expect(AUTH_JS_NETWORK_ERROR_CODES).toContain(res.status);
    expect(await res.json()).toEqual({
      code: 503,
      error_code: 'service_unavailable',
      msg: 'Authentication is temporarily unavailable',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never forwards a client-supplied forwarded-for header upstream', async () => {
    const { req, params } = makeRequest('auth/v1/user', {
      headers: { ...FROM_IP, 'x-real-ip': '203.0.113.9' },
    });

    await GET(req, params);

    const sentHeaders = fetchMock.mock.calls[0][1].headers as Headers;
    expect(sentHeaders.get('x-forwarded-for')).toBeNull();
    expect(sentHeaders.get('sb-forwarded-for')).toBeNull();
  });
});
