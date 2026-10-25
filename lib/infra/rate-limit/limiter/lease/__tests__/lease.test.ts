import { beforeEach, describe, expect, it, vi } from 'vitest';

const reportError = vi.fn();
vi.mock('@/lib/infra/telemetry/monitoring/report-error', () => ({
  reportError,
}));

const { RateLimitedError, RateLimitUnavailableError } = await import(
  '@/lib/core/errors/app-error'
);
const { Errors } = await import('@/lib/core/errors/catalog');
const { acquireSpendLease, resetSpendLeaseForTests, toMicroUsd } = await import(
  '../lease'
);

type Store = Parameters<typeof acquireSpendLease>[1] extends infer O
  ? O extends { store?: infer S }
    ? NonNullable<S>
    : never
  : never;

function fakeStore(
  row: Partial<{
    allowed: boolean;
    reason: string | null;
    retry_after_seconds: number | null;
    spend_day: string | null;
  }> = {}
) {
  const store = {
    reserve: vi.fn(async (_input: unknown) => ({
      allowed: true,
      reason: null,
      retry_after_seconds: null,
      spend_day: '2026-10-25',
      ...row,
    })),
    settle: vi.fn(async (_input: unknown) => undefined),
  };
  return store satisfies Store;
}

const recordEvent = vi.fn();
const now = new Date('2026-10-25T22:00:00Z');

beforeEach(() => {
  resetSpendLeaseForTests();
  reportError.mockReset();
  recordEvent.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('acquireSpendLease', () => {
  it('reserves the estimate against $10, in micro-USD', async () => {
    const store = fakeStore();
    await acquireSpendLease('meal', { store, now, recordEvent });

    expect(store.reserve).toHaveBeenCalledWith({
      route: 'ai:spend:meal',
      spendMicroUsd: 30_000,
      spendLimitMicroUsd: 10_000_000,
      now,
    });
  });

  it.each([
    ['labelOcr', 10_000],
    ['shadow', 30_000],
    ['debug', 50_000],
    ['replay', 50_000],
  ] as const)('reserves %s at its own estimate', async (kind, micro) => {
    const store = fakeStore();
    await acquireSpendLease(kind, { store, now, recordEvent });
    expect(store.reserve.mock.calls[0][0]).toMatchObject({
      spendMicroUsd: micro,
    });
  });

  it('settles the real cost minus the estimate, on the reservation day', async () => {
    const store = fakeStore({ spend_day: '2026-10-24' });
    const lease = await acquireSpendLease('meal', { store, now, recordEvent });

    await lease.settle(0.0048);

    expect(store.settle).toHaveBeenCalledWith({
      route: 'ai:spend:meal',
      spendDay: '2026-10-24',
      deltaMicroUsd: 4800 - 30_000,
    });
  });

  it('keeps the estimate when the cost is unknown, and settles only once', async () => {
    const store = fakeStore();
    const lease = await acquireSpendLease('meal', { store, now, recordEvent });

    await lease.settle(null);
    await lease.settle(0.01);

    expect(store.settle).not.toHaveBeenCalled();
  });

  it('adds a late cost on its own', async () => {
    const store = fakeStore();
    const lease = await acquireSpendLease('meal', { store, now, recordEvent });
    await lease.settle(0.03);
    lease.addLate(0.002);
    await Promise.resolve();

    expect(store.settle).toHaveBeenCalledWith(
      expect.objectContaining({ deltaMicroUsd: 2000 })
    );
  });

  it('never throws when a settle fails', async () => {
    const store = fakeStore();
    store.settle.mockRejectedValue(new Error('db down'));
    const lease = await acquireSpendLease('meal', { store, now, recordEvent });

    await expect(lease.settle(0.001)).resolves.toBeUndefined();
  });

  it('refuses with the RATE_LIMITED 429 the apps already parse once the brake trips', async () => {
    const store = fakeStore({
      allowed: false,
      reason: 'budget',
      retry_after_seconds: 7200,
      spend_day: null,
    });

    const attempt = acquireSpendLease('meal', { store, now, recordEvent });

    await expect(attempt).rejects.toBeInstanceOf(RateLimitedError);
    await expect(attempt).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      retryAfterSeconds: 7200,
      reason: 'ai_paused',
    });
    expect(recordEvent).toHaveBeenCalledWith({
      route: 'ai:spend:meal',
      reason: 'budget',
      source: 'db',
      keyKind: 'global',
      keyHash: 'ai-spend',
      retryAfterSeconds: 7200,
    });
  });

  it('alerts once a UTC day, with a fingerprint per day', async () => {
    const store = fakeStore({ allowed: false, retry_after_seconds: 60 });

    for (let i = 0; i < 3; i++) {
      await acquireSpendLease('meal', { store, now, recordEvent }).catch(
        () => undefined
      );
    }
    await acquireSpendLease('meal', {
      store,
      now: new Date('2026-10-26T00:00:01Z'),
      recordEvent,
    }).catch(() => undefined);

    expect(reportError).toHaveBeenCalledTimes(2);
    expect(reportError.mock.calls[0][2]).toEqual({
      fingerprint: ['ai-spend-brake', '2026-10-25'],
    });
    expect(reportError.mock.calls[1][2]).toEqual({
      fingerprint: ['ai-spend-brake', '2026-10-26'],
    });
  });

  it('fails closed with a 503 when the brake cannot be read', async () => {
    const store = fakeStore();
    store.reserve.mockRejectedValue(
      Errors.rateLimiterUnavailable(new Error('deadline'), 'timeout')
    );

    await expect(
      acquireSpendLease('meal', { store, now, recordEvent })
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'unavailable_timeout' })
    );
  });

  it('wraps an unexpected store error into the 503', async () => {
    const store = fakeStore();
    store.reserve.mockRejectedValue(new Error('connection reset'));

    await expect(
      acquireSpendLease('meal', { store, now, recordEvent })
    ).rejects.toMatchObject({ status: 503, code: 'RATE_LIMITER_UNAVAILABLE' });
  });

  it('with enforce: false, never asks the brake but still counts the cost', async () => {
    const store = fakeStore();
    const lease = await acquireSpendLease('meal', {
      store,
      now,
      recordEvent,
      enforce: false,
    });
    await lease.settle(0.005);

    expect(store.reserve).not.toHaveBeenCalled();
    expect(store.settle).toHaveBeenCalledWith({
      route: 'ai:spend:meal',
      spendDay: '2026-10-25',
      deltaMicroUsd: 5000,
    });
  });
});

describe('an App Review lease', () => {
  it('books the estimate for an unknown cost, since it reserved nothing', async () => {
    const store = fakeStore();
    const lease = await acquireSpendLease('meal', {
      store,
      now,
      recordEvent,
      enforce: false,
    });
    await lease.settle(null);

    expect(store.settle).toHaveBeenCalledWith({
      route: 'ai:spend:meal',
      spendDay: '2026-10-25',
      deltaMicroUsd: 30_000,
    });
  });
});

describe('toMicroUsd', () => {
  it('rounds to whole micro-dollars', () => {
    expect(toMicroUsd(10)).toBe(10_000_000);
    expect(toMicroUsd(0.0048)).toBe(4800);
    expect(toMicroUsd(0.000_000_4)).toBe(0);
  });
});
