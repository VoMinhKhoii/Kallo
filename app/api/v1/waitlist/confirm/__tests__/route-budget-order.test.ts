import { NextRequest } from 'next/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
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
const confirm = vi.fn(async () => ({ status: 'invalid', locale: 'en' }));
vi.mock('@/lib/domain/waitlist/confirm', () => ({
  confirmWaitlistSignup: () => confirm(),
}));

const { GET } = await import('@/app/api/v1/waitlist/confirm/route');

function get(ip: string | null) {
  return GET(
    new NextRequest('http://localhost/api/v1/waitlist/confirm?token=test', {
      headers: ip ? { 'cf-connecting-ip': ip } : {},
    })
  );
}

function globalCount() {
  return (
    [...consumer.rows.entries()].find(([key]) =>
      key.endsWith('|waitlist:global')
    )?.[1].minuteCount ?? 0
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'performance'] });
  vi.setSystemTime(new Date('2026-11-01T10:00:05Z'));
  vi.stubEnv('ORIGIN_SHARED_SECRET', 'test-origin');
  vi.stubEnv('ANALYSIS_GUARD_HASH_SECRET', 'test-hash-secret');
  consumer = createInMemoryRateLimitConsumer();
  resetRateLimitMemoryForTests();
  confirm.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it('charges only IP-admitted confirmations and leaves room for a second IP', async () => {
  for (let index = 0; index < 20; index += 1) {
    expect((await get('203.0.113.4')).status).toBe(307);
  }
  const before = globalCount();
  expect(before).toBe(20);
  for (let index = 0; index < 30; index += 1) {
    expect((await get('203.0.113.4')).status).toBe(429);
  }
  expect(globalCount()).toBe(before);
  expect(confirm).toHaveBeenCalledTimes(20);
  expect((await get('198.51.100.9')).status).toBe(307);
  expect(globalCount()).toBe(before + 1);
});

it('keeps the global-only backstop for a null IP', async () => {
  expect((await get(null)).status).toBe(307);
  expect(globalCount()).toBe(1);
  expect(consumer.rows.size).toBe(1);
});
