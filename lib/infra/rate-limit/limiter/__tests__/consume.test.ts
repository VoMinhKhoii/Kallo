import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimitUnavailableError } from '@/lib/core/errors/app-error';
import { Errors } from '@/lib/core/errors/catalog';
import { serializeError } from '@/lib/core/errors/serialize';
import { createInMemoryRateLimitConsumer } from '../__fixtures__/in-memory-consumer';
import {
  assertRateLimit,
  type ConsumeRateLimitOptions,
  consumeRateLimit,
  orderRateLimitKeys,
  RateLimitPolicyMisuseError,
  resetRateLimitMemoryForTests,
} from '../consume';
import { rateLimitPolicies } from '../policies';
import type {
  RateLimitConsumeRow,
  RateLimitConsumer,
  RateLimitPolicy,
} from '../types';

const allowRow: RateLimitConsumeRow = {
  allowed: true,
  reason: null,
  retry_after_seconds: null,
  remaining_minute: 1,
  remaining_hour: 1,
  remaining_day: 1,
};

function alwaysAllows() {
  return { consume: vi.fn(async () => allowRow) } satisfies RateLimitConsumer;
}

function alwaysFails(error: unknown = new Error('db down')) {
  return {
    consume: vi.fn(async () => {
      throw error;
    }),
  } satisfies RateLimitConsumer;
}

const userKey = { kind: 'user', value: 'user-1' } as const;
const ipKey = { kind: 'ip', value: '203.0.113.9' } as const;
const globalKey = { kind: 'global', value: 'app' } as const;

function options(consumer?: RateLimitConsumer): ConsumeRateLimitOptions {
  return { consumer, recordEvent: vi.fn() };
}

beforeEach(() => {
  resetRateLimitMemoryForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('memory prefilter', () => {
  it('sizes the bucket at perMinute x burstFactor, not the day rate', async () => {
    // authEmailRecipient: perMinute 2, default burstFactor 3 => capacity 6.
    const consumer = alwaysAllows();
    const shared = options(consumer);
    const recipient = {
      kind: 'recipient',
      value: 'target@example.com',
    } as const;

    for (let call = 0; call < 6; call += 1) {
      const result = await consumeRateLimit(
        'authEmailRecipient',
        recipient,
        shared
      );
      expect(result.allowed).toBe(true);
    }

    const seventh = await consumeRateLimit(
      'authEmailRecipient',
      recipient,
      shared
    );

    expect(seventh).toMatchObject({
      allowed: false,
      source: 'memory-prefilter',
      reason: 'flood',
    });
    expect(consumer.consume).toHaveBeenCalledTimes(6);
  });

  it('is skipped entirely for a policy with no perMinute', async () => {
    // ocrGlobalDaily is perDay-only; a burst breaker derived from 5000/day
    // would throttle in-process long before the real limiter sees anything.
    const consumer = alwaysAllows();
    const shared = options(consumer);

    for (let call = 0; call < 50; call += 1) {
      expect(
        (await consumeRateLimit('ocrGlobalDaily', globalKey, shared)).allowed
      ).toBe(true);
    }

    expect(consumer.consume).toHaveBeenCalledTimes(50);
  });
});

describe('failMode', () => {
  it('closed: a DB error becomes RateLimitUnavailableError', async () => {
    const shared = options(alwaysFails());

    await expect(
      consumeRateLimit('ocrGlobalDaily', globalKey, shared)
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);
  });

  it('closed: a deadline rejection is rethrown as-is', async () => {
    const deadline = Errors.rateLimiterUnavailable(new Error('deadline'));
    const shared = options(alwaysFails(deadline));

    await expect(
      consumeRateLimit('ocrGlobalDaily', globalKey, shared)
    ).rejects.toBe(deadline);
  });

  it('closed: records the outage as a rate limit event', async () => {
    const recordEvent = vi.fn();

    await expect(
      consumeRateLimit('ocrGlobalDaily', globalKey, {
        consumer: alwaysFails(),
        recordEvent,
      })
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);

    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'unavailable_error', source: 'db' })
    );
  });

  it('degraded: falls back to the raw per-minute bucket', async () => {
    // chatMessageSend: perMinute 30 => 30 admits, then the bucket is empty.
    const shared = options(alwaysFails());

    for (let call = 0; call < 30; call += 1) {
      const result = await consumeRateLimit('chatMessageSend', userKey, shared);
      expect(result).toMatchObject({ allowed: true, source: 'degraded' });
    }

    expect(
      await consumeRateLimit('chatMessageSend', userKey, shared)
    ).toMatchObject({ allowed: false, source: 'degraded', reason: 'flood' });
  });

  it('degraded: admits when the policy has no per-minute window', async () => {
    // pushGlobalHourly guards the send path; failing it closed would drop the
    // user's message rather than a push.
    const shared = options(alwaysFails());

    expect(
      await consumeRateLimit('pushGlobalHourly', globalKey, shared)
    ).toMatchObject({ allowed: true, source: 'degraded' });
  });

  it('memory: never touches the database', async () => {
    const consumer = alwaysAllows();
    const shared = options(consumer);

    for (let call = 0; call < 30; call += 1) {
      expect((await consumeRateLimit('healthzIp', ipKey, shared)).allowed).toBe(
        true
      );
    }

    expect(await consumeRateLimit('healthzIp', ipKey, shared)).toMatchObject({
      allowed: false,
      source: 'memory-prefilter',
    });
    expect(consumer.consume).not.toHaveBeenCalled();
  });

  it('throttles the failure log to one line per route per window', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const shared = options(alwaysFails());

    await consumeRateLimit('chatMessageSend', userKey, shared);
    await consumeRateLimit('chatMessageSend', userKey, shared);
    await consumeRateLimit('chatMessageSend', userKey, shared);

    expect(logged).toHaveBeenCalledTimes(1);
  });
});

describe('key handling', () => {
  it('ignores keys the policy does not accept', async () => {
    const consumer = alwaysAllows();

    await consumeRateLimit(
      'chatMessageSend',
      [ipKey, userKey, globalKey],
      options(consumer)
    );

    expect(consumer.consume).toHaveBeenCalledTimes(1);
    expect(consumer.consume).toHaveBeenCalledWith(
      expect.objectContaining({ keyKind: 'user' })
    );
  });

  it('skips an unparseable IP but still checks the keys that DO parse', async () => {
    const consumer = alwaysAllows();

    // authEmailIp accepts `ip` only, so the garbage key is dropped and the
    // good one still reaches the limiter — the skip is per key, not per call.
    const result = await consumeRateLimit(
      'authEmailIp',
      [
        { kind: 'ip', value: 'garbage' },
        { kind: 'ip', value: '203.0.113.9' },
      ],
      options(consumer)
    );

    expect(result.allowed).toBe(true);
    expect(consumer.consume).toHaveBeenCalledTimes(1);
  });

  it('orders multi-kind keys global -> ip -> account -> recipient -> user', () => {
    const policy: RateLimitPolicy = {
      route: 'test',
      limits: {},
      keyKinds: ['user', 'ip', 'global', 'account', 'recipient'],
      failMode: 'memory',
    };

    const ordered = orderRateLimitKeys(policy, [
      { kind: 'user', value: 'u' },
      { kind: 'recipient', value: 'r' },
      { kind: 'account', value: 'a' },
      { kind: 'ip', value: '203.0.113.1' },
      { kind: 'global', value: 'g' },
    ]);

    expect(ordered.map((key) => key.kind)).toEqual([
      'global',
      'ip',
      'account',
      'recipient',
      'user',
    ]);
  });
});

describe('assertRateLimit', () => {
  it('throws a 429 carrying Retry-After when the DB blocks', async () => {
    const consumer = createInMemoryRateLimitConsumer();
    const shared = {
      ...options(),
      consumer,
      now: new Date('2026-09-01T10:00:30.250Z'),
    };

    // avatarUpload: perMinute 5.
    for (let call = 0; call < 5; call += 1) {
      await assertRateLimit('avatarUpload', userKey, shared);
    }

    const thrown = await assertRateLimit('avatarUpload', userKey, shared).then(
      () => null,
      (error: unknown) => error
    );

    const response = serializeError(thrown);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('30');
  });

  it('still 429s with the REAL telemetry writer and no database', async () => {
    // `options()` stubs `recordEvent` everywhere else; here the production
    // path runs, so a telemetry failure would surface as a 500 instead of the
    // 429 the caller is owed.
    const consumer = createInMemoryRateLimitConsumer();
    const shared = { consumer, now: new Date('2026-09-01T10:00:30.000Z') };

    for (let call = 0; call < 5; call += 1) {
      await assertRateLimit('avatarUpload', userKey, shared);
    }

    await expect(
      assertRateLimit('avatarUpload', userKey, shared)
    ).rejects.toMatchObject({ status: 429 });
  });

  it('resolves when the policy admits', async () => {
    await expect(
      assertRateLimit('avatarUpload', userKey, options(alwaysAllows()))
    ).resolves.toBeUndefined();
  });
});

describe('no usable key (policy misuse)', () => {
  const garbageIp = { kind: 'ip', value: 'garbage' } as const;

  it('fails fast outside production rather than silently admitting', async () => {
    // Every key unparseable means NOTHING was counted. Returning `allowed`
    // here (the old behaviour) made an unenforced route indistinguishable
    // from an enforced one, in code review and in telemetry alike.
    const consumer = alwaysAllows();

    await expect(
      consumeRateLimit('healthzIp', garbageIp, options(consumer))
    ).rejects.toBeInstanceOf(RateLimitPolicyMisuseError);

    expect(consumer.consume).not.toHaveBeenCalled();
  });

  it('fails fast when the key kind is wrong for the policy', async () => {
    // healthzIp accepts `ip`; a `user` key leaves it with nothing to count.
    await expect(
      consumeRateLimit('healthzIp', userKey, options(alwaysAllows()))
    ).rejects.toBeInstanceOf(RateLimitPolicyMisuseError);
  });

  it('admits in production, but reports source `none`, never `db`', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const recordEvent = vi.fn();

    try {
      const result = await consumeRateLimit('healthzIp', garbageIp, {
        consumer: alwaysAllows(),
        recordEvent,
      });

      expect(result).toMatchObject({ allowed: true, source: 'none' });
      expect(recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'misuse', source: 'none' })
      );
      expect(logged).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('unavailable telemetry', () => {
  it('separates a deadline timeout from an outright DB error', async () => {
    const timeoutEvent = vi.fn();
    const errorEvent = vi.fn();

    await expect(
      consumeRateLimit('ocrGlobalDaily', globalKey, {
        consumer: alwaysFails(
          Errors.rateLimiterUnavailable(new Error('deadline'), 'timeout')
        ),
        recordEvent: timeoutEvent,
      })
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);

    expect(timeoutEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'unavailable_timeout' })
    );

    resetRateLimitMemoryForTests();

    await expect(
      consumeRateLimit('ocrGlobalDaily', globalKey, {
        consumer: alwaysFails(new Error('connection refused')),
        recordEvent: errorEvent,
      })
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);

    expect(errorEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'unavailable_error' })
    );
  });
});

describe('prefilter refill', () => {
  it('refills at capacity/60 per second, not perMinute/60', async () => {
    // avatarUpload: perMinute 5, burstFactor 3 => capacity 15, refill 0.25/s.
    // A regression to the old `perMinute/60` (0.083/s) formula would need 12s
    // to hand back the three tokens this test takes back in 12s at 0.25/s.
    const consumer = alwaysAllows();
    let clockMs = 1_000_000;
    const shared: ConsumeRateLimitOptions = {
      consumer,
      recordEvent: vi.fn(),
      nowMs: () => clockMs,
    };

    for (let call = 0; call < 15; call += 1) {
      expect(
        (await consumeRateLimit('avatarUpload', userKey, shared)).allowed
      ).toBe(true);
    }

    const flooded = await consumeRateLimit('avatarUpload', userKey, shared);
    expect(flooded).toMatchObject({
      allowed: false,
      source: 'memory-prefilter',
      reason: 'flood',
      // ceil(1 / 0.25) = 4s to the next token.
      retryAfterSeconds: 4,
    });

    // 12s at 0.25 tokens/s = exactly 3 tokens back.
    clockMs += 12_000;

    for (let call = 0; call < 3; call += 1) {
      expect(
        (await consumeRateLimit('avatarUpload', userKey, shared)).allowed
      ).toBe(true);
    }

    expect(
      (await consumeRateLimit('avatarUpload', userKey, shared)).allowed
    ).toBe(false);
  });
});

describe('policy registry', () => {
  it('gives every policy a unique route', () => {
    const routes = Object.values(rateLimitPolicies).map(
      (policy) => policy.route
    );

    expect(new Set(routes).size).toBe(routes.length);
  });

  it('only fails closed where admitting means SPENDING', () => {
    const closed = Object.entries(rateLimitPolicies)
      .filter(([, policy]) => policy.failMode === 'closed')
      .map(([name]) => name)
      .sort();

    // Both of these spend Gemini quota per admitted request, which is the only
    // reason to fail closed: admitting with the guard down means spending money
    // with no ceiling. Every auth or read surface must stay `degraded` —
    // failing THOSE closed hands an attacker a denial of service against
    // sign-in by attacking the limiter instead.
    expect(closed).toEqual(['adminDebugAnalysis', 'ocrGlobalDaily']);
  });
});
