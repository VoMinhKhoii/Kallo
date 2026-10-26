import { beforeEach, describe, expect, it, vi } from 'vitest';

const reportError = vi.fn();
vi.mock('@/lib/infra/telemetry/monitoring/report-error', () => ({
  reportError,
}));

const { RateLimitedError, RateLimitUnavailableError } = await import(
  '@/lib/core/errors/app-error'
);
const { Errors } = await import('@/lib/core/errors/catalog');
const {
  acquireRateLimit,
  acquireSpendLease,
  resetSpendLeaseForTests,
  toMicroUsd,
  withRateLimit,
} = await import('../lease');
const { resetRateLimitMemoryForTests } = await import('../../consume');

type Store = Parameters<typeof acquireSpendLease>[1] extends infer O
  ? O extends { store?: infer S }
    ? NonNullable<S>
    : never
  : never;

/** What the fake consume grants a call that asks for a slot. */
const SLOT_EXPIRES_AT = '2026-10-25 22:01:30+00';

function fakeStore(
  row: Partial<{
    allowed: boolean;
    reason: string | null;
    retry_after_seconds: number | null;
    spend_day: string | null;
    slot_expires_at: string | null;
  }> = {}
) {
  const store = {
    consume: vi.fn(async (input: { slot: unknown }) => ({
      allowed: true,
      reason: null,
      retry_after_seconds: null,
      spend_day: '2026-10-25',
      slot_expires_at: input.slot ? SLOT_EXPIRES_AT : null,
      ...row,
    })),
    release: vi.fn(async (_input: unknown) => undefined),
  };
  return store satisfies Store;
}

const recordEvent = vi.fn();
const now = new Date('2026-10-25T22:00:00Z');

beforeEach(() => {
  resetSpendLeaseForTests();
  resetRateLimitMemoryForTests();
  reportError.mockReset();
  recordEvent.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('acquireSpendLease', () => {
  it('reserves the estimate against $10, in micro-USD', async () => {
    const store = fakeStore();
    await acquireSpendLease('meal', { store, now, recordEvent });

    expect(store.consume).toHaveBeenCalledWith({
      keyKind: 'global',
      keyHash: null,
      route: 'ai:spend:meal',
      limits: null,
      slot: null,
      spendMicroUsd: 30_000,
      spendLimitMicroUsd: 10_000_000,
      now,
      timeoutMs: 2000,
    });
  });

  it.each([
    ['labelOcr', 10_000],
    ['shadow', 30_000],
    ['debug', 50_000],
  ] as const)('reserves %s at its own estimate', async (kind, micro) => {
    const store = fakeStore();
    await acquireSpendLease(kind, { store, now, recordEvent });
    expect(store.consume.mock.calls[0][0]).toMatchObject({
      spendMicroUsd: micro,
    });
  });

  it('settles the real cost minus the estimate, on the reservation day', async () => {
    const store = fakeStore({ spend_day: '2026-10-24' });
    const lease = await acquireSpendLease('meal', { store, now, recordEvent });

    await lease.release(0.0048);

    expect(store.release).toHaveBeenCalledWith({
      keyKind: 'global',
      keyHash: null,
      slotExpiresAt: null,
      route: 'ai:spend:meal',
      spendDay: '2026-10-24',
      deltaMicroUsd: 4800 - 30_000,
      timeoutMs: 2000,
    });
  });

  it('keeps the estimate when the cost is unknown, and settles only once', async () => {
    const store = fakeStore();
    const lease = await acquireSpendLease('meal', { store, now, recordEvent });

    await lease.release(null);
    await lease.release(0.01);

    expect(store.release).not.toHaveBeenCalled();
  });

  it('adds a late cost on its own', async () => {
    const store = fakeStore();
    const lease = await acquireSpendLease('meal', { store, now, recordEvent });
    await lease.release(0.03);
    lease.addLate(0.002);
    await Promise.resolve();

    expect(store.release).toHaveBeenCalledWith(
      expect.objectContaining({ deltaMicroUsd: 2000 })
    );
  });

  it('never throws when a settle fails', async () => {
    const store = fakeStore();
    store.release.mockRejectedValue(new Error('db down'));
    const lease = await acquireSpendLease('meal', { store, now, recordEvent });

    await expect(lease.release(0.001)).resolves.toBeUndefined();
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
    const store = fakeStore({
      allowed: false,
      reason: 'budget',
      retry_after_seconds: 60,
    });

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
    store.consume.mockRejectedValue(
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
    store.consume.mockRejectedValue(new Error('connection reset'));

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
    await lease.release(0.005);

    expect(store.consume).not.toHaveBeenCalled();
    expect(store.release).toHaveBeenCalledWith({
      keyKind: 'global',
      keyHash: null,
      slotExpiresAt: null,
      route: 'ai:spend:meal',
      spendDay: '2026-10-25',
      deltaMicroUsd: 5000,
      timeoutMs: 2000,
    });
  });
});

const user = { kind: 'user', value: 'user-1' } as const;

describe('acquireRateLimit', () => {
  it("takes the policy's windows and slot in one call", async () => {
    const store = fakeStore({ spend_day: null });
    await acquireRateLimit('analyzeMeal', user, { store, now, recordEvent });

    expect(store.consume).toHaveBeenCalledOnce();
    expect(store.consume.mock.calls[0][0]).toMatchObject({
      keyKind: 'user',
      keyHash: expect.stringMatching(/^v1:[a-f0-9]{64}$/),
      route: 'analyze-meal',
      limits: { perDay: 30 },
      slot: { limit: 1, ttlSeconds: 90 },
      spendMicroUsd: null,
      spendLimitMicroUsd: null,
    });
  });

  it('frees the slot on release, once', async () => {
    const store = fakeStore({ spend_day: null });
    const lease = await acquireRateLimit('analyzeMeal', user, {
      store,
      now,
      recordEvent,
    });

    await lease.release();
    await lease.release();

    expect(store.release).toHaveBeenCalledOnce();
    expect(store.release.mock.calls[0][0]).toMatchObject({
      keyKind: 'user',
      keyHash: (
        store.consume.mock.calls[0][0] as unknown as { keyHash: string }
      ).keyHash,
      slotExpiresAt: SLOT_EXPIRES_AT,
      route: 'analyze-meal',
      spendDay: null,
      deltaMicroUsd: null,
    });
  });

  it('with countWindows: false, takes the slot without counting the day', async () => {
    const store = fakeStore({ spend_day: null });
    await acquireRateLimit('analyzeMeal', user, {
      store,
      now,
      recordEvent,
      countWindows: false,
    });

    expect(store.consume.mock.calls[0][0]).toMatchObject({
      limits: null,
      slot: { limit: 1, ttlSeconds: 90 },
    });
  });

  it("answers a held slot with the policy's Retry-After, as in_flight", async () => {
    const store = fakeStore({
      allowed: false,
      reason: 'concurrent',
      retry_after_seconds: 88,
    });

    await expect(
      acquireRateLimit('analyzeMeal', user, { store, now, recordEvent })
    ).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      retryAfterSeconds: 15,
      reason: 'in_flight',
    });
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ route: 'analyze-meal', reason: 'concurrent' })
    );
  });

  it('answers a used-up day as daily_limit, with the window Retry-After', async () => {
    const store = fakeStore({
      allowed: false,
      reason: 'day',
      retry_after_seconds: 3600,
    });

    await expect(
      acquireRateLimit('analyzeMeal', user, { store, now, recordEvent })
    ).rejects.toMatchObject({ retryAfterSeconds: 3600, reason: 'daily_limit' });
  });

  it('a minute window refusal carries no reason, so callers word it generically', async () => {
    const store = fakeStore({
      allowed: false,
      reason: 'minute',
      retry_after_seconds: 40,
    });

    const error = await acquireRateLimit('labelOcr', user, {
      store,
      now,
      recordEvent,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateLimitedError);
    expect(error).toMatchObject({ retryAfterSeconds: 40, reason: undefined });
  });

  it('fails a closed policy with a 503 when the database cannot answer', async () => {
    const store = fakeStore();
    store.consume.mockRejectedValue(new Error('connection reset'));

    await expect(
      acquireRateLimit('analyzeMeal', user, { store, now, recordEvent })
    ).rejects.toMatchObject({ status: 503, code: 'RATE_LIMITER_UNAVAILABLE' });
  });

  it('lets a degraded policy through on its bucket, holding no slot', async () => {
    const store = fakeStore();
    store.consume.mockRejectedValue(new Error('connection reset'));
    const lease = await acquireRateLimit('relogWrite', user, {
      store,
      now,
      recordEvent,
    });

    await lease.release();
    expect(store.release).not.toHaveBeenCalled();
  });

  it('refuses a key kind the policy does not accept', async () => {
    await expect(
      acquireRateLimit(
        'analyzeMeal',
        { kind: 'ip', value: '203.0.113.9' },
        { store: fakeStore(), now, recordEvent }
      )
    ).rejects.toThrow(/resolved no usable key/);
  });
});

describe('acquireSpendLease with a rate limit', () => {
  it('checks the key and the brake in one call, and settles both in one', async () => {
    const store = fakeStore({ spend_day: '2026-10-25' });
    const lease = await acquireSpendLease('meal', {
      store,
      now,
      recordEvent,
      rateLimit: { policy: 'analyzeMeal', key: user },
    });
    await lease.release(0.005);

    expect(store.consume).toHaveBeenCalledOnce();
    expect(store.consume.mock.calls[0][0]).toMatchObject({
      keyKind: 'user',
      route: 'analyze-meal',
      limits: { perDay: 30 },
      slot: { limit: 1, ttlSeconds: 90 },
      spendMicroUsd: 30_000,
      spendLimitMicroUsd: 10_000_000,
    });
    expect(store.release).toHaveBeenCalledOnce();
    expect(store.release.mock.calls[0][0]).toMatchObject({
      keyKind: 'user',
      keyHash: expect.any(String),
      slotExpiresAt: SLOT_EXPIRES_AT,
      route: 'analyze-meal',
      spendDay: '2026-10-25',
      deltaMicroUsd: 5000 - 30_000,
    });
  });

  it('a late cost settles spend only, never the slot again', async () => {
    const store = fakeStore();
    const lease = await acquireSpendLease('meal', {
      store,
      now,
      recordEvent,
      rateLimit: { policy: 'analyzeMeal', key: user },
    });
    await lease.release(0.03);
    lease.addLate(0.001);
    await Promise.resolve();

    expect(store.release).toHaveBeenCalledTimes(2);
    expect(store.release.mock.calls[1][0]).toMatchObject({
      keyHash: null,
      slotExpiresAt: null,
      deltaMicroUsd: 1000,
    });
  });

  it('a brake refusal is ai_paused even with a key in the call', async () => {
    const store = fakeStore({
      allowed: false,
      reason: 'budget',
      retry_after_seconds: 500,
    });

    await expect(
      acquireSpendLease('meal', {
        store,
        now,
        recordEvent,
        rateLimit: { policy: 'analyzeMeal', key: user },
      })
    ).rejects.toMatchObject({ reason: 'ai_paused', retryAfterSeconds: 500 });
  });

  it('App Review: no brake, but the slot is still taken', async () => {
    const store = fakeStore({ spend_day: null });
    await acquireSpendLease('meal', {
      store,
      now,
      recordEvent,
      enforce: false,
      rateLimit: { policy: 'analyzeMeal', key: user, countWindows: false },
    });

    expect(store.consume.mock.calls[0][0]).toMatchObject({
      limits: null,
      slot: { limit: 1, ttlSeconds: 90 },
      spendMicroUsd: null,
      spendLimitMicroUsd: null,
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
    await lease.release(null);

    expect(store.release).toHaveBeenCalledWith(
      expect.objectContaining({ keyHash: null, deltaMicroUsd: 30_000 })
    );
  });
});

describe('withRateLimit', () => {
  it('releases the slot when the work throws', async () => {
    const store = fakeStore({ spend_day: null });

    await expect(
      withRateLimit(
        'relogWrite',
        user,
        async () => {
          throw new Error('work failed');
        },
        { store, now, recordEvent }
      )
    ).rejects.toThrow('work failed');
    expect(store.release).toHaveBeenCalledOnce();
  });

  it('never runs the work when refused', async () => {
    const store = fakeStore({
      allowed: false,
      reason: 'concurrent',
      retry_after_seconds: 80,
    });
    const work = vi.fn(async () => 'ran');

    await expect(
      withRateLimit('relogWrite', user, work, { store, now, recordEvent })
    ).rejects.toMatchObject({ retryAfterSeconds: 5, reason: 'in_flight' });
    expect(work).not.toHaveBeenCalled();
  });
});

describe('toMicroUsd', () => {
  it('rounds to whole micro-dollars', () => {
    expect(toMicroUsd(10)).toBe(10_000_000);
    expect(toMicroUsd(0.0048)).toBe(4800);
    expect(toMicroUsd(0.000_000_4)).toBe(0);
  });
});
