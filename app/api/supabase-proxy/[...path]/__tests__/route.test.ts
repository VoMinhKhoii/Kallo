import type { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');

const consoleError = vi
  .spyOn(console, 'error')
  .mockImplementation(() => undefined);

const { GET, POST } = await import('@/app/api/supabase-proxy/[...path]/route');

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
      body: '{}',
    });
    const res = await POST(req, params);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'upstream_unreachable' });
    expect(consoleError).toHaveBeenCalled();
  });
});
