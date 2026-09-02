/**
 * The deadline half of `createSqlRateLimitConsumer` — no database required.
 *
 * `withDeadline` cancels the query before it rejects, and `cancel()` in
 * postgres.js dials a SECOND connection to send the CancelRequest. That
 * connection can fail: the server may have restarted, crashed or reset the
 * peer in exactly the window where we are trying to abort. The cancel is
 * therefore best effort, and its failure must never escape — an unhandled
 * rejection raised while shedding load would turn a 503 into a dead process.
 *
 * These cases pin that: whatever `cancel()` does, the caller still gets
 * `RateLimitUnavailableError` with `kind: 'timeout'`, and nothing reaches
 * `process`'s `unhandledRejection`.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { RateLimitUnavailableError } from '@/lib/core/errors/app-error';
import { createSqlRateLimitConsumer } from '../sql-consumer';

const INPUT = {
  keyKind: 'user',
  keyHash: 'v1:test',
  route: 'test:sql-consumer',
  limits: { perMinute: 1 },
} as const;

/**
 * A `PendingQuery` stand-in that never settles, so the deadline is guaranteed
 * to be what resolves the race.
 */
function neverSettlingQuery(cancel: () => unknown) {
  const pending = new Promise<never>(() => undefined) as Promise<never> & {
    cancel: () => unknown;
  };
  pending.cancel = cancel;
  return pending;
}

function consumerOver(pending: unknown) {
  return createSqlRateLimitConsumer({
    $client: { unsafe: () => pending },
  } as unknown as Parameters<typeof createSqlRateLimitConsumer>[0]);
}

/** Node reports an unhandled rejection on `process`, not on the promise. */
function captureUnhandledRejections() {
  const seen: unknown[] = [];
  const listener = (reason: unknown) => seen.push(reason);

  process.on('unhandledRejection', listener);

  return {
    seen,
    async settle() {
      // Unhandled rejections surface after the microtask checkpoint; give the
      // event loop a couple of real turns before asserting nothing arrived.
      await new Promise((resolve) => setTimeout(resolve, 50));
      process.off('unhandledRejection', listener);
      return seen;
    },
  };
}

const previousTimeout = process.env.LIMITER_DB_TIMEOUT_MS;
process.env.LIMITER_DB_TIMEOUT_MS = '10';

afterAll(() => {
  if (previousTimeout === undefined) {
    delete process.env.LIMITER_DB_TIMEOUT_MS;
  } else {
    process.env.LIMITER_DB_TIMEOUT_MS = previousTimeout;
  }
});

describe('createSqlRateLimitConsumer deadline', () => {
  it('still reports a timeout when cancel() throws synchronously', async () => {
    const watcher = captureUnhandledRejections();
    let cancelled = false;
    const consumer = consumerOver(
      neverSettlingQuery(() => {
        cancelled = true;
        throw new TypeError("Cannot read properties of null (reading 'write')");
      })
    );

    const error = await consumer
      .consume({ ...INPUT })
      .catch((thrown) => thrown);

    expect(cancelled).toBe(true);
    expect(error).toBeInstanceOf(RateLimitUnavailableError);
    expect((error as RateLimitUnavailableError).kind).toBe('timeout');
    expect(await watcher.settle()).toEqual([]);
  });

  it('still reports a timeout when cancel() returns a rejected promise', async () => {
    const watcher = captureUnhandledRejections();
    let cancelled = false;
    const consumer = consumerOver(
      neverSettlingQuery(() => {
        cancelled = true;
        // What postgres.js does when the CancelRequest socket errors.
        return Promise.reject(new Error('write CONNECTION_CLOSED'));
      })
    );

    const error = await consumer
      .consume({ ...INPUT })
      .catch((thrown) => thrown);

    expect(cancelled).toBe(true);
    expect(error).toBeInstanceOf(RateLimitUnavailableError);
    expect((error as RateLimitUnavailableError).kind).toBe('timeout');
    expect(await watcher.settle()).toEqual([]);
  });

  it('issues the cancel BEFORE it rejects', async () => {
    // The order is the whole guarantee: a caller must never be handed its 503
    // while the query it paid for is still on its way to the database.
    const order: string[] = [];
    const consumer = consumerOver(
      neverSettlingQuery(() => {
        order.push('cancel');
        return undefined;
      })
    );

    await consumer.consume({ ...INPUT }).catch(() => order.push('reject'));

    expect(order).toEqual(['cancel', 'reject']);
  });
});
