import { describe, expect, it } from 'vitest';
import { createInMemoryRateLimitConsumer } from '../__fixtures__/in-memory-consumer';
import type { RateLimitLimits } from '../types';

const key = { keyKind: 'user', keyHash: 'v1:abc', route: 'test' } as const;

function consumeAt(
  consumer: ReturnType<typeof createInMemoryRateLimitConsumer>,
  limits: RateLimitLimits,
  now: string
) {
  return consumer.consume({ ...key, limits, now: new Date(now) });
}

describe('in-memory rate limit consumer (reference model)', () => {
  it('allows exactly up to the limit, then blocks on the smallest window', async () => {
    const consumer = createInMemoryRateLimitConsumer();
    const limits = { perMinute: 2 };
    const at = '2026-09-01T10:00:00.000Z';

    expect((await consumeAt(consumer, limits, at)).allowed).toBe(true);
    const second = await consumeAt(consumer, limits, at);
    expect(second.allowed).toBe(true);
    expect(second.remaining_minute).toBe(0);

    const blocked = await consumeAt(consumer, limits, at);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('minute');
  });

  it('does not consume on a block', async () => {
    const consumer = createInMemoryRateLimitConsumer();
    const limits = { perMinute: 2, perDay: 100 };
    const at = '2026-09-01T10:00:00.000Z';

    await consumeAt(consumer, limits, at);
    await consumeAt(consumer, limits, at);
    await consumeAt(consumer, limits, at);
    await consumeAt(consumer, limits, at);

    const [row] = [...consumer.rows.values()];
    expect(row.minuteCount).toBe(2);
    // The day window must not have been charged for the two refused calls.
    expect(row.dayCount).toBe(2);
  });

  it('rolls the minute window forward without touching the day window', async () => {
    const consumer = createInMemoryRateLimitConsumer();
    const limits = { perMinute: 1, perDay: 10 };

    expect(
      (await consumeAt(consumer, limits, '2026-09-01T10:00:30.000Z')).allowed
    ).toBe(true);
    expect(
      (await consumeAt(consumer, limits, '2026-09-01T10:00:45.000Z')).allowed
    ).toBe(false);
    expect(
      (await consumeAt(consumer, limits, '2026-09-01T10:01:00.000Z')).allowed
    ).toBe(true);

    const [row] = [...consumer.rows.values()];
    expect(row.minuteCount).toBe(1);
    expect(row.dayCount).toBe(2);
  });

  it('reports minute before hour before day', async () => {
    const consumer = createInMemoryRateLimitConsumer();
    const limits = { perMinute: 5, perHour: 1 };
    const at = '2026-09-01T10:00:00.000Z';

    await consumeAt(consumer, limits, at);
    const blocked = await consumeAt(consumer, limits, at);

    expect(blocked.reason).toBe('hour');
  });

  it('waits out the LATEST exhausted window, not the smallest', async () => {
    // Minute AND hour both exhausted at 10:00:30. `reason` names the minute
    // (the tightest ceiling), but a client told to retry in 30s would be
    // refused again by the hour window for the next 59.5 minutes — so the
    // wait is measured to 11:00:00.
    const consumer = createInMemoryRateLimitConsumer();
    const limits = { perMinute: 2, perHour: 2 };
    const at = '2026-09-01T10:00:30.000Z';

    await consumeAt(consumer, limits, at);
    await consumeAt(consumer, limits, at);
    const blocked = await consumeAt(consumer, limits, at);

    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('minute');
    expect(blocked.retry_after_seconds).toBe(3570);
  });

  it('reports the seconds left in the exhausted window', async () => {
    const consumer = createInMemoryRateLimitConsumer();
    const limits = { perMinute: 1 };
    const at = '2026-09-01T10:00:30.250Z';

    await consumeAt(consumer, limits, at);
    const blocked = await consumeAt(consumer, limits, at);

    // 29.75s remain in the minute; a caller must never be told to retry early.
    expect(blocked.retry_after_seconds).toBe(30);
  });

  it('never blocks when every window is unenforced', async () => {
    const consumer = createInMemoryRateLimitConsumer();
    const at = '2026-09-01T10:00:00.000Z';

    for (let index = 0; index < 50; index += 1) {
      expect((await consumeAt(consumer, {}, at)).allowed).toBe(true);
    }
  });

  it('never increments an unenforced window', async () => {
    const consumer = createInMemoryRateLimitConsumer();
    const limits = { perDay: 5 };
    const at = '2026-09-01T10:00:00.000Z';

    await consumeAt(consumer, limits, at);
    await consumeAt(consumer, limits, at);
    await consumeAt(consumer, limits, at);

    const [row] = [...consumer.rows.values()];
    expect(row.minuteCount).toBe(0);
    expect(row.hourCount).toBe(0);
    expect(row.dayCount).toBe(3);
  });

  it('admits exactly one of twenty concurrent calls at perMinute 1', async () => {
    const consumer = createInMemoryRateLimitConsumer();
    const limits = { perMinute: 1 };
    const at = new Date('2026-09-01T10:00:00.000Z');

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        consumer.consume({ ...key, limits, now: at })
      )
    );

    expect(results.filter((row) => row.allowed)).toHaveLength(1);
  });
});
