import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Errors } from '@/lib/core/errors/catalog';
import { createFakeDb } from '@/lib/infra/db/__fixtures__/fake-db';
import type { AppDb } from '@/lib/infra/db/client';

let fake = createFakeDb();
vi.mock('@/lib/infra/db/client', () => ({
  db: new Proxy({} as AppDb, {
    get: (_, key) => Reflect.get(fake.db, key),
  }),
}));
vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({
  assertRateLimit: vi.fn(),
}));
vi.mock('@/lib/infra/telemetry/monitoring/report-error', () => ({
  reportError: vi.fn(),
}));
const send = vi.fn();
vi.mock('@/lib/infra/email/send', () => ({
  sendEmail: (...args: unknown[]) => send(...args),
}));

const { POST } = await import('@/app/api/v1/waitlist/route');
const { NextRequest } = await import('next/server');

function post() {
  return POST(
    new NextRequest('http://localhost/api/v1/waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'person@example.test' }),
    })
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  fake = createFakeDb();
  send.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it.each([
  Errors.rateLimited('Provider busy'),
  Errors.internal(new Error('Provider unavailable')),
])('answers a rejected confirmation send with the same 200 body', async (error) => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fake.queueSelect([]);
  send.mockRejectedValueOnce(error);
  const pending = post();
  await vi.runAllTimersAsync();
  const response = await pending;
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(fake.updates.at(-1)).toEqual({ confirmationSentAt: null });
});

it('answers confirmed and new signups together with a delayed send', async () => {
  const settled: number[] = [];
  const startedAt = Date.now();
  fake.queueSelect([{ id: 'confirmed', confirmedAt: new Date() }]);
  const confirmed = post().then((response) => {
    settled.push(Date.now() - startedAt);
    return response;
  });
  // Let the first request consume its queued row before starting the next.
  await vi.advanceTimersByTimeAsync(0);
  fake.queueSelect([]);
  send.mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    return { id: null, skipped: false };
  });
  const fresh = post().then((response) => {
    settled.push(Date.now() - startedAt);
    return response;
  });
  await vi.advanceTimersByTimeAsync(4499);
  expect(settled).toEqual([]);
  await vi.advanceTimersByTimeAsync(1);
  expect(settled).toEqual([4500, 4500]);
  for (const response of await Promise.all([confirmed, fresh])) {
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  }
  expect(send).toHaveBeenCalledTimes(1);
});
