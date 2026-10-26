import type { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The Turnstile gate on the auth proxy: which requests owe a token at which
 * rollout stage, and that a refused request never reaches the limiter (no
 * token) or Supabase (no or bad token).
 */

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');

const assertRateLimit = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({
  assertRateLimit: (...args: unknown[]) => assertRateLimit(...args),
}));

const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

const { POST } = await import('@/app/api/supabase-proxy/[...path]/route');

function post(path: string, body: unknown) {
  const url = new URL(`http://localhost/api/supabase-proxy/${path}`);
  const req = new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-client-info': 'supabase-flutter/2.12.4',
      'x-forwarded-for': '203.0.113.7',
    },
    body: JSON.stringify(body),
  }) as unknown as { nextUrl?: URL };
  req.nextUrl = url;
  const [pathname] = path.split('?');
  return POST(req as unknown as NextRequest, {
    params: Promise.resolve({ path: pathname.split('/') }),
  });
}

const withToken = (token: string) => ({
  email: 'khoi@example.com',
  create_user: true,
  gotrue_meta_security: { captcha_token: token },
});
const noToken = { email: 'khoi@example.com', create_user: true };

/** Routes the stubbed fetch: siteverify answers `verdict`, Supabase 200s. */
function answer(verdict: { success: boolean } | 'down') {
  fetchMock.mockImplementation(async (url: URL | string) => {
    if (String(url) === SITEVERIFY) {
      if (verdict === 'down') return new Response('', { status: 500 });
      return Response.json(verdict);
    }
    return Response.json({});
  });
}

const supabaseCalls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url) !== SITEVERIFY);
const siteverifyCalls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url) === SITEVERIFY);

beforeEach(() => {
  fetchMock.mockReset();
  assertRateLimit.mockClear();
  consoleInfo.mockClear();
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret-key');
  vi.stubEnv('TURNSTILE_SITE_KEY', 'site-key');
  vi.stubEnv('TURNSTILE_MODE', 'codes');
  answer({ success: true });
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Turnstile gate — enforced on code requests', () => {
  it('refuses a code request with no token before the limiter or Supabase', async () => {
    const res = await post('auth/v1/otp', noToken);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: 400,
      error_code: 'captcha_failed',
      msg: 'captcha verification failed',
    });
    expect(assertRateLimit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks the token with Cloudflare, with the user IP, then forwards', async () => {
    const res = await post('auth/v1/otp', withToken('tok-1'));

    expect(res.status).toBe(200);
    expect(siteverifyCalls()).toHaveLength(1);
    const form = siteverifyCalls()[0][1].body as URLSearchParams;
    expect(form.get('secret')).toBe('secret-key');
    expect(form.get('response')).toBe('tok-1');
    expect(form.get('remoteip')).toBe('203.0.113.7');
    // The limiter ran first: a junk-token flood is throttled per IP.
    expect(assertRateLimit).toHaveBeenCalled();
    expect(supabaseCalls()).toHaveLength(1);
    expect(consoleInfo).toHaveBeenCalledWith(
      '[turnstile] path=otp mode=codes outcome=valid client=supabase-flutter'
    );
  });

  it('refuses a token Cloudflare rejects', async () => {
    answer({ success: false });

    const res = await post('auth/v1/magiclink', withToken('replayed'));

    expect(res.status).toBe(400);
    expect((await res.json()).error_code).toBe('captcha_failed');
    expect(supabaseCalls()).toHaveLength(0);
  });

  it('answers a retryable 503 when Cloudflare cannot be asked', async () => {
    answer('down');

    const res = await post('auth/v1/otp', withToken('tok-1'));

    expect(res.status).toBe(503);
    expect(supabaseCalls()).toHaveLength(0);
  });

  it('leaves the old sign-up, reset and resend paths open at this stage', async () => {
    for (const path of ['signup', 'recover', 'resend']) {
      fetchMock.mockClear();
      const res = await post(`auth/v1/${path}`, noToken);
      expect(res.status, path).toBe(200);
      expect(supabaseCalls(), path).toHaveLength(1);
    }
  });

  it('never gates the password grant or code verification', async () => {
    vi.stubEnv('TURNSTILE_MODE', 'all');

    const password = await post('auth/v1/token?grant_type=password', {
      email: 'khoi@example.com',
      password: 'hunter22',
    });
    const verify = await post('auth/v1/verify', {
      email: 'khoi@example.com',
      token: '123456',
      type: 'email',
    });

    expect(password.status).toBe(200);
    expect(verify.status).toBe(200);
    expect(siteverifyCalls()).toHaveLength(0);
  });
});

describe('Turnstile gate — rollout stages', () => {
  it('refuses the old email paths too once the mode is "all"', async () => {
    vi.stubEnv('TURNSTILE_MODE', 'all');

    for (const path of ['signup', 'recover', 'resend']) {
      const res = await post(`auth/v1/${path}`, noToken);
      expect(res.status, path).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only logs in monitor mode, even for a rejected token', async () => {
    vi.stubEnv('TURNSTILE_MODE', 'monitor');
    answer({ success: false });

    const missing = await post('auth/v1/otp', noToken);
    const rejected = await post('auth/v1/otp', withToken('bad'));

    expect(missing.status).toBe(200);
    expect(rejected.status).toBe(200);
    expect(consoleInfo).toHaveBeenCalledWith(
      '[turnstile] path=otp mode=monitor outcome=missing client=supabase-flutter'
    );
    expect(consoleInfo).toHaveBeenCalledWith(
      '[turnstile] path=otp mode=monitor outcome=invalid client=supabase-flutter'
    );
  });

  it('treats an unknown mode as monitor, never as off or as a lockout', async () => {
    vi.stubEnv('TURNSTILE_MODE', 'enforce');

    const res = await post('auth/v1/otp', noToken);

    expect(res.status).toBe(200);
    expect(consoleInfo).toHaveBeenCalledWith(
      expect.stringContaining('mode=monitor outcome=missing')
    );
  });

  it.each([
    ['no secret (local dev)', 'TURNSTILE_SECRET_KEY'],
    // No client could render a widget, so enforcing would lock everyone out.
    ['a secret but no site key', 'TURNSTILE_SITE_KEY'],
  ])('checks nothing with %s', async (_name, unset) => {
    vi.stubEnv(unset, '');

    const res = await post('auth/v1/otp', noToken);

    expect(res.status).toBe(200);
    expect(siteverifyCalls()).toHaveLength(0);
    expect(consoleInfo).not.toHaveBeenCalled();
  });

  it('defaults to monitor once both keys are set, so old builds keep working', async () => {
    vi.stubEnv('TURNSTILE_MODE', '');

    for (const path of ['otp', 'signup', 'recover', 'resend']) {
      const res = await post(`auth/v1/${path}`, noToken);
      expect(res.status, path).toBe(200);
    }
    expect(consoleInfo).toHaveBeenCalledWith(
      expect.stringContaining('mode=monitor outcome=missing')
    );
  });

  it('reads the token case-insensitively, as GoTrue would', async () => {
    const res = await post('auth/v1/otp', {
      email: 'khoi@example.com',
      Gotrue_Meta_Security: { Captcha_Token: 'tok-2' },
    });

    expect(res.status).toBe(200);
    const form = siteverifyCalls()[0][1].body as URLSearchParams;
    expect(form.get('response')).toBe('tok-2');
  });
});
