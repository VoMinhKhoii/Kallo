import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryRateLimitConsumer } from '@/lib/infra/rate-limit/limiter/__fixtures__/in-memory-consumer';
import { resetRateLimitMemoryForTests } from '@/lib/infra/rate-limit/limiter/limiter';

let consumer = createInMemoryRateLimitConsumer();
vi.mock('@/lib/infra/rate-limit/limiter/sql-consumer', () => ({
  createSqlRateLimitConsumer: () => consumer,
}));
vi.mock('@/lib/infra/rate-limit/limiter/events', () => ({
  recordRateLimitEvent: vi.fn(),
}));
vi.mock('@/lib/infra/db/client', () => ({ db: {} }));
vi.mock('@/lib/infra/telemetry/monitoring/report-error', () => ({
  reportError: vi.fn(),
}));

const { POST } = await import('@/app/api/supabase-proxy/[...path]/route');
const fetchMock = vi.fn();
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const IP_A = '203.0.113.9';
const IP_B = '198.51.100.20';

function post(path: string, body: unknown, ip: string | null = IP_A) {
  const request = new NextRequest(
    `http://localhost/api/supabase-proxy/auth/v1/${path}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(ip ? { 'cf-connecting-ip': ip } : {}),
      },
      body: JSON.stringify(body),
    }
  );
  return POST(request, {
    params: Promise.resolve({ path: ['auth', 'v1', path.split('?')[0]] }),
  });
}

function count(route: string) {
  return [...consumer.rows.entries()]
    .filter(([key]) => key.endsWith(`|${route}`))
    .reduce((total, [, row]) => total + row.minuteCount, 0);
}

const emailBody = (token: string) => ({
  email: 'owner@example.test',
  gotrue_meta_security: { captcha_token: token },
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'performance'] });
  vi.setSystemTime(new Date('2026-11-01T10:00:05Z'));
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('ORIGIN_SHARED_SECRET', 'test-origin');
  vi.stubEnv('ANALYSIS_GUARD_HASH_SECRET', 'test-hash-secret');
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret');
  vi.stubEnv('TURNSTILE_SITE_KEY', 'test-site');
  vi.stubEnv('TURNSTILE_MODE', 'off');
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  consumer = createInMemoryRateLimitConsumer();
  resetRateLimitMemoryForTests();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => Response.json({}));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('auth shared-budget admission', () => {
  it.each([
    {
      op: 'login',
      path: 'verify',
      admitted: 30,
      status: 429,
      global: 'auth:global',
    },
    {
      op: 'email',
      path: 'recover',
      admitted: 10,
      status: 429,
      global: 'auth:global',
    },
    {
      op: 'refresh',
      path: 'token?grant_type=refresh_token',
      admitted: 600,
      status: 503,
      global: 'auth:refresh:global',
    },
  ])('keeps $op IP refusals out of the global budget', async (test) => {
    const body = (index: number) =>
      test.op === 'refresh'
        ? { refresh_token: 'test-refresh' }
        : test.op === 'email'
          ? { email: `person-${index}@example.test` }
          : {};
    for (let index = 0; index < test.admitted; index += 1) {
      expect((await post(test.path, body(index))).status).toBe(200);
    }
    const before = count(test.global);
    expect(before).toBe(test.admitted);
    for (let index = 0; index < 300; index += 1) {
      expect((await post(test.path, body(index))).status).toBe(test.status);
    }
    expect(count(test.global)).toBe(before);
    expect((await post(test.path, body(999), IP_B)).status).toBe(200);
    expect(count(test.global)).toBe(before + 1);
  });

  it.each([
    'codes',
    'all',
  ])('does not charge shared budgets for captcha_failed in %s mode', async (mode) => {
    vi.stubEnv('TURNSTILE_MODE', mode);
    fetchMock.mockImplementation(async (url) =>
      String(url) === SITEVERIFY
        ? Response.json({ success: false })
        : Response.json({})
    );
    const response = await post('otp', emailBody('invalid-token'));
    expect(response.status).toBe(400);
    expect((await response.json()).error_code).toBe('captcha_failed');
    expect(count('auth:email:ip')).toBe(1);
    expect(count('auth:global')).toBe(0);
    expect(count('auth:email:recipient')).toBe(0);

    fetchMock.mockImplementation(async () => Response.json({ success: true }));
    expect((await post('otp', emailBody('valid-token'), IP_B)).status).toBe(
      200
    );
    expect(count('auth:email:recipient')).toBe(1);
  });

  it('stops IP refusals before siteverify', async () => {
    vi.stubEnv('TURNSTILE_MODE', 'codes');
    fetchMock.mockImplementation(async () => Response.json({ success: false }));
    for (let index = 0; index < 10; index += 1) {
      expect((await post('otp', emailBody(`token-${index}`))).status).toBe(400);
    }
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect((await post('otp', emailBody('next-token'))).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(count('auth:global')).toBe(0);
  });

  it('keeps an unavailable enforced captcha out of shared budgets', async () => {
    vi.stubEnv('TURNSTILE_MODE', 'codes');
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));
    expect((await post('otp', emailBody('token'))).status).toBe(503);
    expect(count('auth:global')).toBe(0);
    expect(count('auth:email:recipient')).toBe(0);
  });

  it('still charges admitted requests with invalid tokens in monitor mode', async () => {
    vi.stubEnv('TURNSTILE_MODE', 'monitor');
    fetchMock.mockImplementation(async () => Response.json({ success: false }));
    expect((await post('otp', emailBody('token'))).status).toBe(200);
    expect(count('auth:global')).toBe(1);
    expect(count('auth:email:recipient')).toBe(1);
  });

  it.each([
    ['verify', {}, 'auth:global'],
    [
      'token?grant_type=refresh_token',
      { refresh_token: 'test-refresh' },
      'auth:refresh:global',
    ],
  ])('still charges the global budget without an IP on %s', async (path, body, route) => {
    expect((await post(path, body, null)).status).toBe(200);
    expect(count(route)).toBe(1);
  });
});
