/**
 * The deadlines of `createSqlLeaseStore` — no database required.
 *
 * The consume and the release give up waiting the same way but differ on
 * what happens to the query. A consume past its deadline is CANCELLED, so an
 * abandoned call cannot take a window or a slot for a request it refused. A
 * release past its deadline is left RUNNING: cancelling it kept the slot held
 * for its whole 90 s lifetime and refused its holder's next request (relog's
 * picker and staging, Oct 2026), while a release that lands late still frees
 * the slot.
 */

import { describe, expect, it, vi } from 'vitest';
import { RateLimitUnavailableError } from '@/lib/core/errors/app-error';
import { createSqlLeaseStore } from '../lease-sql';

/** A `PendingQuery` stand-in that settles only when the test says so. */
function controllableQuery() {
  let resolve: (rows: unknown[]) => void = () => undefined;
  const pending = new Promise<unknown[]>((r) => {
    resolve = r;
  }) as Promise<unknown[]> & { cancel: ReturnType<typeof vi.fn> };
  pending.cancel = vi.fn();
  return { pending, resolve };
}

function storeOver(pending: unknown) {
  return createSqlLeaseStore({
    $client: { unsafe: () => pending },
  } as unknown as Parameters<typeof createSqlLeaseStore>[0]);
}

const RELEASE = {
  keyKind: 'user',
  keyHash: 'v1:test',
  slotExpiresAt: '2026-10-27 10:01:30+00',
  route: 'relog:write',
  spendDay: null,
  deltaMicroUsd: null,
  timeoutMs: 10,
} as const;

describe('createSqlLeaseStore deadlines', () => {
  it('stops waiting on a slow release but never cancels it', async () => {
    const query = controllableQuery();
    const store = storeOver(query.pending);

    const error = await store.release(RELEASE).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RateLimitUnavailableError);
    expect((error as RateLimitUnavailableError).kind).toBe('timeout');
    expect(query.pending.cancel).not.toHaveBeenCalled();
    // The query is still live and may land after the deadline, harmlessly.
    query.resolve([]);
    await expect(query.pending).resolves.toEqual([]);
  });

  it('cancels a consume that misses its deadline', async () => {
    const query = controllableQuery();
    const store = storeOver(query.pending);

    await expect(
      store.consume({
        keyKind: 'user',
        keyHash: 'v1:test',
        route: 'relog:write',
        limits: { perMinute: 12 },
        slot: { limit: 1, ttlSeconds: 90 },
        spendMicroUsd: null,
        spendLimitMicroUsd: null,
        timeoutMs: 10,
      })
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);
    expect(query.pending.cancel).toHaveBeenCalledOnce();
  });
});
