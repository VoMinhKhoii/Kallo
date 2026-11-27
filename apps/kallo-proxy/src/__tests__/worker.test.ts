// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { classifySurface, type Env, ipKey } from '../worker';

const ORIGIN = 'kallo-prod-test.asia-southeast1.run.app';

function makeEnv(allow: { anon?: boolean; refresh?: boolean } = {}) {
  return {
    ORIGIN,
    ORIGIN_SECRET: 'origin-secret',
    ANON_FLOOD: {
      limit: vi.fn(async (_options: { key: string }) => ({
        success: allow.anon ?? true,
      })),
    },
    REFRESH_FLOOD: {
      limit: vi.fn(async (_options: { key: string }) => ({
        success: allow.refresh ?? true,
      })),
    },
  } satisfies Env;
}

function request(
  path: string,
  init: RequestInit & { ip?: string | null } = {}
): Request {
  const { ip = '203.0.113.9', ...rest } = init;
  const headers = new Headers(rest.headers);
  if (ip) headers.set('cf-connecting-ip', ip);
  return new Request(`https://kallo.fit${path}`, { ...rest, headers });
}

const upstream = vi.fn(
  async (_req: Request) => new Response('from origin', { status: 200 })
);

beforeEach(() => {
  upstream.mockClear();
  vi.stubGlobal('fetch', upstream);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('classifySurface', () => {
  const at = (path: string, method?: string) =>
    classifySurface(new URL(`https://kallo.fit${path}`), method)?.name ?? null;

  it.each([
    ['/api/supabase-proxy/auth/v1/signup', 'auth'],
    ['/api/supabase-proxy/auth/v1/token?grant_type=password', 'auth'],
    [
      '/api/supabase-proxy/auth/v1/token?grant_type=refresh_token',
      'auth-refresh',
    ],
    ['/api/v1/waitlist', 'waitlist'],
    ['/api/v1/waitlist/confirm', 'waitlist'],
    ['/api/healthz', 'healthz'],
    ['/api/csp-report', 'csp-report'],
    ['/api/v1/groups/invite/abc123', 'invite'],
    ['/api/v1/barcode/image/8935001234567', 'barcode-image'],
  ])('%s is the %s surface', (path, name) => {
    expect(at(path)).toBe(name);
  });

  it.each([
    '/en/dashboard',
    '/api/analyze-meal',
    '/api/v1/waitlist/other',
    '/api/healthzzz',
  ])('%s is not covered', (path) => {
    expect(at(path)).toBeNull();
  });

  it('cannot be stepped around by case, encoding or doubled slashes', () => {
    expect(at('/API/Supabase-Proxy/auth/v1/signup')).toBe('auth');
    expect(at('/api/supabase%2Dproxy/auth/v1/recover')).toBe('auth');
    expect(at('//api//healthz')).toBe('healthz');
  });

  it('covers the invite lookup, not the signed-in invite accept', () => {
    expect(at('/api/v1/groups/invite/accept', 'POST')).toBeNull();
    expect(at('/api/v1/groups/invite/abc123', 'GET')).toBe('invite');
  });
});

describe('ipKey', () => {
  it('keeps an IPv4 address as is', () => {
    expect(ipKey('203.0.113.9')).toBe('203.0.113.9');
  });

  it('cuts IPv6 to its /64, so one household is one key', () => {
    expect(ipKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2::/64');
    expect(ipKey('2001:db8:1:2:1111::1')).toBe('2001:db8:1:2::/64');
    expect(ipKey('2001:0DB8::1')).toBe('2001:db8:0:0::/64');
  });
});

describe('fetch', () => {
  it('forwards to the origin with the origin-lock headers, overwriting a forged one', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      request('/en/dashboard?x=1', {
        headers: { 'X-Origin-Verify': 'forged' },
      }),
      env
    );

    expect(res.status).toBe(200);
    const sent = upstream.mock.calls[0][0];
    expect(sent.url).toBe(`https://${ORIGIN}/en/dashboard?x=1`);
    expect(sent.headers.get('X-Origin-Verify')).toBe('origin-secret');
    expect(sent.headers.get('X-Forwarded-Host')).toBe('kallo.fit');
    expect(sent.headers.get('X-Forwarded-Proto')).toBe('https');
    expect(env.ANON_FLOOD.limit).not.toHaveBeenCalled();
  });

  it('keys the breaker on the surface and the address', async () => {
    const env = makeEnv();
    await worker.fetch(
      request('/api/v1/waitlist', { method: 'POST', ip: '2001:db8:1:2::9' }),
      env
    );

    expect(env.ANON_FLOOD.limit).toHaveBeenCalledWith({
      key: 'waitlist:2001:db8:1:2::/64',
    });
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("refuses an auth flood in GoTrue's own shape, without reaching the origin", async () => {
    const res = await worker.fetch(
      request('/api/supabase-proxy/auth/v1/signup', { method: 'POST' }),
      makeEnv({ anon: false })
    );

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('60');
    expect(await res.json()).toEqual({
      code: 429,
      error_code: 'over_request_rate_limit',
      msg: 'Request rate limit reached',
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('refuses a refresh flood as a 503, which keeps the session', async () => {
    const env = makeEnv({ refresh: false });
    const res = await worker.fetch(
      request('/api/supabase-proxy/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
      }),
      env
    );

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      code: 503,
      error_code: 'service_unavailable',
    });
    expect(env.ANON_FLOOD.limit).not.toHaveBeenCalled();
  });

  it("refuses an app-route flood in the app's own RATE_LIMITED envelope", async () => {
    const res = await worker.fetch(
      request('/api/v1/barcode/image/8935001234567'),
      makeEnv({ anon: false })
    );

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('60');
    expect(await res.json()).toEqual({
      error: {
        code: 'RATE_LIMITED',
        status: 429,
        retryable: true,
        message: 'Too many requests. Please wait a moment and try again.',
        resolution:
          'Wait for Retry-After when present, then retry with backoff.',
      },
    });
  });

  it('forwards when there is no address to key on', async () => {
    const env = makeEnv({ anon: false });
    await worker.fetch(request('/api/healthz', { ip: null }), env);

    expect(env.ANON_FLOOD.limit).not.toHaveBeenCalled();
    expect(upstream).toHaveBeenCalledOnce();
  });

  it('forwards when the breaker itself fails', async () => {
    const env = makeEnv();
    env.ANON_FLOOD.limit.mockRejectedValue(new Error('binding unavailable'));
    const res = await worker.fetch(request('/api/healthz'), env);

    expect(res.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });
});

describe('fetch: crawler copies of public pages', () => {
  const GPTBOT =
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot';
  const SAFARI =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

  const sent = () =>
    upstream.mock.calls[0] as unknown as [
      Request,
      (RequestInit & { cf?: Record<string, unknown> }) | undefined,
    ];

  it('fetches a crawler page through the cache, under its own address', async () => {
    await worker.fetch(
      request('/vi/calories/mi-goi', { headers: { 'User-Agent': GPTBOT } }),
      makeEnv()
    );

    const [req, init] = sent();
    expect(req.url).toBe(`https://${ORIGIN}/vi/calories/mi-goi?_edge=crawler`);
    expect(req.headers.get('X-Origin-Verify')).toBe('origin-secret');
    expect(init?.cf).toEqual({
      cacheEverything: true,
      cacheTtlByStatus: { '200-299': 86_400, '300-599': -1 },
    });
  });

  it.each([
    ['a browser', '/en/calories/pho', { 'User-Agent': SAFARI }],
    ['a crawler on the landing page', '/en', { 'User-Agent': GPTBOT }],
    ['a crawler on pricing', '/en/pricing', { 'User-Agent': GPTBOT }],
    [
      'a crawler with a cookie',
      '/en/calories/pho',
      { 'User-Agent': GPTBOT, Cookie: 'sb-access-token=x' },
    ],
    [
      'a client-side navigation',
      '/en/docs/overview',
      { 'User-Agent': GPTBOT, RSC: '1' },
    ],
    ['an API call', '/api/v1/foods', { 'User-Agent': GPTBOT }],
    [
      'an agent asking for Markdown',
      '/en/docs/overview',
      { 'User-Agent': GPTBOT, Accept: 'text/markdown, text/html;q=0.5' },
    ],
    [
      'a client that takes neither HTML nor Markdown',
      '/en/docs/overview',
      { 'User-Agent': GPTBOT, Accept: 'application/json' },
    ],
    [
      'a trailing-slash URL, which redirects',
      '/en/calories/pho/',
      { 'User-Agent': GPTBOT },
    ],
    [
      'a browser whose user agent says "bot"',
      '/en/calories/pho',
      {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 13; CUBOT P80) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Sec-CH-UA': '"Chromium";v="120"',
        'Sec-Fetch-Mode': 'navigate',
      },
    ],
  ])('sends %s straight to the origin', async (_name, path, headers) => {
    await worker.fetch(request(path, { headers }), makeEnv());

    const [req, init] = sent();
    expect(new URL(req.url).search).toBe('');
    expect(init).toBeUndefined();
  });

  it.each([
    ['no Accept header', undefined],
    ['a browser-style Accept', 'text/html,application/xhtml+xml,*/*;q=0.8'],
    ['any type', '*/*'],
  ])('caches the HTML answer for %s', async (_name, accept) => {
    const headers: Record<string, string> = { 'User-Agent': GPTBOT };
    if (accept) headers.Accept = accept;
    await worker.fetch(request('/en/docs/overview', { headers }), makeEnv());

    expect(sent()[1]?.cf).toBeDefined();
  });

  it('keeps the cache to kallo.fit itself', async () => {
    const headers = new Headers({
      'User-Agent': GPTBOT,
      'cf-connecting-ip': '203.0.113.9',
    });
    await worker.fetch(
      new Request('https://www.kallo.fit/en/calories/pho', { headers }),
      makeEnv()
    );

    expect(sent()[1]).toBeUndefined();
  });

  it.each([
    [
      'https://kallo.fit/en/docs/overview?_edge=crawler',
      'https://kallo.fit/en/docs/overview',
    ],
    ['/en/docs/overview?_edge=crawler', '/en/docs/overview'],
    ['/en/docs/overview?a=1&_edge=crawler', '/en/docs/overview?a=1'],
  ])('takes the cache address out of a redirect to %s', async (location, expected) => {
    upstream.mockResolvedValueOnce(
      new Response(null, { status: 307, headers: { location } })
    );
    const res = await worker.fetch(
      request('/en/docs', { headers: { 'User-Agent': GPTBOT } }),
      makeEnv()
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(expected);
  });

  it('leaves a query string alone, so no variant gets cached', async () => {
    await worker.fetch(
      request('/en/calories/pho?utm_source=x', {
        headers: { 'User-Agent': GPTBOT },
      }),
      makeEnv()
    );

    const [req, init] = sent();
    expect(req.url).toBe(`https://${ORIGIN}/en/calories/pho?utm_source=x`);
    expect(init).toBeUndefined();
  });

  it('only caches reads', async () => {
    await worker.fetch(
      request('/en/calories/pho', {
        method: 'POST',
        headers: { 'User-Agent': GPTBOT },
      }),
      makeEnv()
    );

    expect(sent()[1]).toBeUndefined();
  });
});

describe('scheduled: the meal-reminder tick', () => {
  const event = { cron: '*/15 * * * *', scheduledTime: 0 };

  it('posts the tick to the origin with the origin lock and the bearer', async () => {
    const env = { ...makeEnv(), REMINDER_TICK_SECRET: 'tick-secret' };
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await worker.scheduled(event, env);

    expect(upstream).toHaveBeenCalledOnce();
    const [url, init] = upstream.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`https://${ORIGIN}/api/v1/reminders/tick`);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'X-Origin-Verify': 'origin-secret',
      Authorization: 'Bearer tick-secret',
    });
    log.mockRestore();
  });

  it('does nothing without its secret', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await worker.scheduled(event, makeEnv());

    expect(upstream).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('logs a failed tick instead of throwing', async () => {
    const env = { ...makeEnv(), REMINDER_TICK_SECRET: 'tick-secret' };
    upstream.mockResolvedValueOnce(new Response('nope', { status: 503 }));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(worker.scheduled(event, env)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith('reminder tick failed: 503 nope');
    error.mockRestore();
  });
});
