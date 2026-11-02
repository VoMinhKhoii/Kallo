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
const signup = vi.fn();
vi.mock('@/lib/domain/waitlist/signup', () => ({
  signUpForWaitlist: (...args: unknown[]) => signup(...args),
}));

const { POST } = await import('@/app/api/v1/waitlist/route');

function post(ip: string | null, email = 'person@example.test') {
  return POST(
    new NextRequest('http://localhost/api/v1/waitlist', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(ip ? { 'cf-connecting-ip': ip } : {}),
      },
      body: JSON.stringify({ email, locale: 'en' }),
    })
  );
}

function throttledFlags() {
  return signup.mock.calls.map(
    (call) => (call[1] as { mailboxThrottled?: boolean }).mailboxThrottled
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
  signup.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it('charges only IP-admitted signups and leaves room for a second IP', async () => {
  for (let index = 0; index < 5; index += 1) {
    expect(
      (await post('203.0.113.4', `person${index}@example.test`)).status
    ).toBe(200);
  }
  const before = globalCount();
  expect(before).toBe(5);
  for (let index = 0; index < 30; index += 1) {
    expect((await post('203.0.113.4')).status).toBe(429);
  }
  expect(globalCount()).toBe(before);
  expect(signup).toHaveBeenCalledTimes(5);
  expect((await post('198.51.100.9')).status).toBe(200);
  expect(globalCount()).toBe(before + 1);
});

it('keeps global and mailbox controls for a null IP', async () => {
  expect((await post(null)).status).toBe(200);
  expect(globalCount()).toBe(1);
  expect(consumer.rows.size).toBe(2);
});

it('shares a recipient budget across Gmail dot and plus spellings from distinct IPs', async () => {
  expect((await post('203.0.113.1', 'person@gmail.com')).status).toBe(200);
  expect((await post('203.0.113.2', 'person+news@gmail.com')).status).toBe(200);
  expect((await post('203.0.113.3', 'p.er.son@gmail.com')).status).toBe(200);
  // A refused mailbox answers like a signup; the domain stores nothing.
  expect(throttledFlags()).toEqual([false, true, true]);
});

it('keeps distinct non-Gmail plus mailboxes on separate budgets', async () => {
  expect((await post('203.0.113.1', 'person@example.com')).status).toBe(200);
  expect((await post('203.0.113.2', 'person+news@example.com')).status).toBe(
    200
  );
  expect(signup).toHaveBeenCalledTimes(2);
});

it('caps a canonical mailbox daily even when each rolling cooldown has passed', async () => {
  for (let index = 0; index < 5; index += 1) {
    expect((await post(null, `person+${index}@gmail.com`)).status).toBe(200);
    vi.advanceTimersByTime(5 * 60 * 1000);
  }
  expect((await post(null, 'p.erson@gmail.com')).status).toBe(200);
  expect(throttledFlags()).toEqual([false, false, false, false, false, true]);
});

it('does not spend a recipient budget when the earlier global policy refuses', async () => {
  for (let index = 0; index < 30; index += 1) {
    expect((await post(null, `person${index}@example.test`)).status).toBe(200);
  }
  expect((await post(null, 'fresh@example.test')).status).toBe(429);
  vi.advanceTimersByTime(60 * 1000);
  expect((await post(null, 'fresh@example.test')).status).toBe(200);
});
