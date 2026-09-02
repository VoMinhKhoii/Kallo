import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  flushRateLimitEventsForTests,
  type RateLimitEventInput,
  recordRateLimitEvent,
  resetRateLimitEventsForTests,
} from '../events';
import { resetLogThrottleForTests } from '../log-throttle';

/**
 * A stand-in for the two calls the aggregator makes on the drizzle handle.
 * `values()` resolves, so the fire-and-forget path completes; the recorded
 * batches are what the assertions read.
 */
function fakeDb() {
  const batches: Record<string, unknown>[][] = [];

  return {
    batches,
    insert: vi.fn(() => ({
      values: (rows: Record<string, unknown>[]) => {
        batches.push(rows);
        return Promise.resolve();
      },
    })),
  };
}

function block(overrides: Partial<RateLimitEventInput> = {}) {
  return {
    route: 'auth:email:ip',
    reason: 'minute',
    source: 'db',
    keyKind: 'ip',
    keyHash: 'v1:aaa',
    retryAfterSeconds: 30,
    ...overrides,
  } satisfies RateLimitEventInput;
}

beforeEach(() => {
  resetRateLimitEventsForTests();
  resetLogThrottleForTests();
});

afterEach(() => {
  resetRateLimitEventsForTests();
  vi.restoreAllMocks();
});

describe('recordRateLimitEvent', () => {
  it('coalesces a flood on one key into a single row', () => {
    // The whole point: 100 blocked requests used to be 100 INSERTs into a
    // LOGGED, indexed table on a 2-connection pool — the flood breaker
    // turning the flood into database write amplification.
    const db = fakeDb();

    for (let hit = 0; hit < 100; hit += 1) {
      recordRateLimitEvent(block(), db);
    }

    expect(db.insert).not.toHaveBeenCalled();

    flushRateLimitEventsForTests(db);

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.batches).toHaveLength(1);
    expect(db.batches[0]).toHaveLength(1);
    expect(db.batches[0][0]).toMatchObject({
      route: 'auth:email:ip',
      reason: 'minute',
      source: 'db',
      keyHash: 'v1:aaa',
      hits: 100,
    });
  });

  it('keeps distinct routes, keys, reasons and sources apart', () => {
    const db = fakeDb();

    recordRateLimitEvent(block(), db);
    recordRateLimitEvent(block({ route: 'auth:login:ip' }), db);
    recordRateLimitEvent(block({ keyHash: 'v1:bbb' }), db);
    recordRateLimitEvent(block({ reason: 'hour' }), db);
    recordRateLimitEvent(block({ source: 'memory-prefilter' }), db);

    flushRateLimitEventsForTests(db);

    expect(db.batches[0]).toHaveLength(5);
  });

  it('records first-seen and last-seen for an aggregate', () => {
    const db = fakeDb();

    recordRateLimitEvent(block(), db);
    recordRateLimitEvent(block(), db);
    flushRateLimitEventsForTests(db);

    const row = db.batches[0][0] as { createdAt: Date; lastSeenAt: Date };
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.lastSeenAt.getTime()).toBeGreaterThanOrEqual(
      row.createdAt.getTime()
    );
  });

  it('caps distinct entries and counts the overflow instead of growing', () => {
    // An attacker minting a fresh key per request must not be able to grow
    // this map without bound — past the cap we count and allocate nothing.
    const db = fakeDb();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    for (let index = 0; index < 2500; index += 1) {
      recordRateLimitEvent(block({ keyHash: `v1:key-${index}` }), db);
    }

    flushRateLimitEventsForTests(db);

    // 2000 buffered, written 200 at a time; 500 distinct keys were dropped.
    expect(db.batches[0]).toHaveLength(200);
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('dropped 500 distinct event keys')
    );
  });

  it('writes at most one batch per flush and carries the rest', () => {
    const db = fakeDb();

    for (let index = 0; index < 450; index += 1) {
      recordRateLimitEvent(block({ keyHash: `v1:key-${index}` }), db);
    }

    flushRateLimitEventsForTests(db);
    flushRateLimitEventsForTests(db);
    flushRateLimitEventsForTests(db);

    expect(db.batches.map((batch) => batch.length)).toEqual([200, 200, 50]);
  });

  it('never throws when the db handle is unusable', () => {
    // The real handle is a lazy Proxy that throws SYNCHRONOUSLY on `.insert`
    // with no DATABASE_URL. Telemetry must not turn a 429 into a 500.
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const brokenDb = {
      get insert(): never {
        throw new Error('DATABASE_URL is not set');
      },
    };

    expect(() => {
      recordRateLimitEvent(block(), brokenDb);
      flushRateLimitEventsForTests(brokenDb);
    }).not.toThrow();

    expect(logged).toHaveBeenCalledWith(
      '[rate-limit] failed to record events',
      expect.any(Error)
    );
  });

  it('does not throw on the 429 path when DATABASE_URL is unset', () => {
    // The default handle is the real lazy Proxy. This is the production shape
    // of the previous test: a 429 in an environment with no database must
    // still be a 429.
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const previous = process.env.DATABASE_URL;
    // Unset, not empty-string: this must be the shape a real deployment
    // without a database has.
    delete process.env.DATABASE_URL;

    try {
      expect(() => {
        recordRateLimitEvent(block());
        flushRateLimitEventsForTests();
      }).not.toThrow();

      expect(logged).toHaveBeenCalledWith(
        '[rate-limit] failed to record events',
        expect.any(Error)
      );
    } finally {
      if (previous !== undefined) process.env.DATABASE_URL = previous;
    }
  });

  it('never throws when the insert rejects', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rejectingDb = {
      insert: () => ({ values: () => Promise.reject(new Error('boom')) }),
    };

    recordRateLimitEvent(block(), rejectingDb);
    expect(() => flushRateLimitEventsForTests(rejectingDb)).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(logged).toHaveBeenCalledWith(
      '[rate-limit] failed to record events',
      expect.any(Error)
    );
  });
});
