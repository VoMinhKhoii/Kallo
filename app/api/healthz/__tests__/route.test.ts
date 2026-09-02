import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Errors } from '@/lib/core/errors/catalog';

const execute = vi.fn();
const consoleError = vi
  .spyOn(console, 'error')
  .mockImplementation(() => undefined);
const consoleInfo = vi
  .spyOn(console, 'info')
  .mockImplementation(() => undefined);

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    execute,
  },
}));

const assertRateLimit = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({
  assertRateLimit: (...args: unknown[]) => assertRateLimit(...args),
}));

const { GET } = await import('@/app/api/healthz/route');
const { resetSharedDatabaseHealthForTests } = await import(
  '@/app/api/healthz/_lib/shared-db-health'
);

const HEALTHY = {
  has_user_profiles: true,
  has_food_table: true,
  has_food_source_id: true,
  has_new_user_trigger: true,
  has_seeded_food: true,
  has_orphaned_auth_users: false,
};

function makeRequest(
  headers: Record<string, string> = { 'x-forwarded-for': '203.0.113.4' }
): NextRequest {
  return new Request('http://localhost/api/healthz', {
    headers,
  }) as unknown as NextRequest;
}

describe('GET /api/healthz', () => {
  beforeEach(() => {
    execute.mockReset();
    consoleError.mockClear();
    consoleInfo.mockClear();
    assertRateLimit.mockReset();
    assertRateLimit.mockResolvedValue(undefined);
    resetSharedDatabaseHealthForTests();
  });

  it('returns exactly { ok, service } when the invariants hold', async () => {
    execute.mockResolvedValueOnce([HEALTHY]);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: 'kallo' });
    // The details an operator needs are logged, not published.
    expect(consoleInfo).toHaveBeenCalledWith(
      expect.stringContaining('[healthz]'),
      expect.objectContaining({ hasNewUserTrigger: true })
    );
  });

  it('returns 503 and logs which invariant failed', async () => {
    execute.mockResolvedValueOnce([
      {
        ...HEALTHY,
        has_new_user_trigger: false,
        has_orphaned_auth_users: true,
      },
    ]);

    const res = await GET(makeRequest());

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, service: 'kallo' });
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('FAILED'),
      expect.objectContaining({
        hasNewUserTrigger: false,
        hasOrphanedAuthUsers: true,
      })
    );
  });

  it('returns 503 when the probe query itself fails', async () => {
    execute.mockRejectedValueOnce(new Error('DATABASE_URL is not set.'));

    const res = await GET(makeRequest());

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      ok: false,
      service: 'kallo',
      error: 'Shared database health check failed.',
    });
    expect(consoleError).toHaveBeenCalled();
  });

  it('charges the memory-only IP policy', async () => {
    execute.mockResolvedValueOnce([HEALTHY]);

    await GET(makeRequest());

    expect(assertRateLimit).toHaveBeenCalledWith('healthzIp', {
      kind: 'ip',
      value: '203.0.113.4',
    });
  });

  it('skips the limiter when there is no usable client IP', async () => {
    execute.mockResolvedValueOnce([HEALTHY]);

    const res = await GET(makeRequest({}));

    expect(assertRateLimit).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('answers a throttled probe in the error envelope, not as health JSON', async () => {
    assertRateLimit.mockRejectedValueOnce(Errors.rateLimited(undefined, 5));

    const res = await GET(makeRequest());

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('5');
    expect((await res.json()).error.code).toBe('RATE_LIMITED');
    expect(execute).not.toHaveBeenCalled();
  });

  it('runs one query for concurrent probes, then serves the cached result', async () => {
    execute.mockResolvedValue([HEALTHY]);

    const [first, second] = await Promise.all([
      GET(makeRequest()),
      GET(makeRequest()),
    ]);
    const third = await GET(makeRequest());

    expect(execute).toHaveBeenCalledTimes(1);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
  });

  // The deploy smoke gate retries five times over ten seconds. If an unhealthy
  // answer were cached, every retry would replay it and the loop would be
  // decoration.
  it('does not cache an unhealthy result', async () => {
    execute.mockResolvedValueOnce([{ ...HEALTHY, has_seeded_food: false }]);
    execute.mockResolvedValueOnce([HEALTHY]);

    expect((await GET(makeRequest())).status).toBe(503);
    expect((await GET(makeRequest())).status).toBe(200);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed probe', async () => {
    execute.mockRejectedValueOnce(new Error('connection refused'));
    execute.mockResolvedValueOnce([HEALTHY]);

    expect((await GET(makeRequest())).status).toBe(503);
    expect((await GET(makeRequest())).status).toBe(200);
  });
});
