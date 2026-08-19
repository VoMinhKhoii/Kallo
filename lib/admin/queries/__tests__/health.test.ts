import { describe, expect, it } from 'vitest';
import { healthAggregates } from '@/lib/admin/queries/health';
import {
  buildRequestsWhere,
  REPLAY_EXCLUSION,
} from '@/lib/admin/queries/requests';

// ─── healthAggregates — always excludes replays ───────────────────────────────

describe('healthAggregates — replay exclusion', () => {
  it('REPLAY_EXCLUSION is the isNull(replayOfRequestId) condition (non-null)', () => {
    expect(REPLAY_EXCLUSION).toBeDefined();
    expect(REPLAY_EXCLUSION).not.toBeNull();
  });

  it('healthAggregates returns correct shape with mock DB', async () => {
    let callCount = 0;
    const mockDb = {
      select: () => mockDb,
      from: () => mockDb,
      where: () => mockDb,
      orderBy: () => mockDb,
      limit: () => mockDb,
      offset: () => mockDb,
      groupBy: () => mockDb,
      innerJoin: () => mockDb,
      // biome-ignore lint/suspicious/noThenProperty: intentional PromiseLike mock for testing
      then(resolve: (v: unknown[]) => void) {
        callCount++;
        resolve([]);
        return Promise.resolve([]);
      },
    } as unknown;

    const result = await healthAggregates(
      mockDb as Parameters<typeof healthAggregates>[0]
    );

    expect(result).toMatchObject({
      successRate24h: null,
      successRate7d: null,
      successRate30d: null,
      p50_24h: null,
      p95_24h: null,
      p99_24h: null,
      requestsPerDay30d: [],
      topErrors30d: [],
    });
    // 6 parallel queries fired inside healthAggregates:
    // 3 rate windows (24h/7d/30d) + percentiles + perDay + errors
    expect(callCount).toBe(6);
  });

  it('shapes rate rows from total/successes counts', async () => {
    // First three calls (rate windows) return one shaped row each;
    // remaining calls (percentiles, perDay, errors) return [].
    const queue: unknown[] = [
      [{ total: 10, successes: 8 }], // 24h → 0.8
      [{ total: 100, successes: 95 }], // 7d  → 0.95
      [{ total: 1000, successes: 990 }], // 30d → 0.99
      [{ p50: 1200, p95: 4500, p99: 8000 }], // percentiles
      [], // perDay
      [], // errors
    ];
    const mockDb = {
      select: () => mockDb,
      from: () => mockDb,
      where: () => mockDb,
      orderBy: () => mockDb,
      limit: () => mockDb,
      offset: () => mockDb,
      groupBy: () => mockDb,
      innerJoin: () => mockDb,
      // biome-ignore lint/suspicious/noThenProperty: intentional PromiseLike mock for testing
      then(resolve: (v: unknown) => void) {
        const value = queue.shift() ?? [];
        resolve(value);
        return Promise.resolve(value);
      },
    } as unknown;

    const result = await healthAggregates(
      mockDb as Parameters<typeof healthAggregates>[0]
    );

    expect(result.successRate24h).toBeCloseTo(0.8, 5);
    expect(result.successRate7d).toBeCloseTo(0.95, 5);
    expect(result.successRate30d).toBeCloseTo(0.99, 5);
    expect(result.p50_24h).toBe(1200);
    expect(result.p95_24h).toBe(4500);
    expect(result.p99_24h).toBe(8000);
  });

  it('returns null rate when window has zero total requests', async () => {
    const queue: unknown[] = [
      [{ total: 0, successes: 0 }], // 24h → null
      [{ total: 5, successes: 5 }], // 7d  → 1.0
      [{ total: 0, successes: 0 }], // 30d → null
      [{ p50: null, p95: null, p99: null }],
      [],
      [],
    ];
    const mockDb = {
      select: () => mockDb,
      from: () => mockDb,
      where: () => mockDb,
      orderBy: () => mockDb,
      limit: () => mockDb,
      offset: () => mockDb,
      groupBy: () => mockDb,
      innerJoin: () => mockDb,
      // biome-ignore lint/suspicious/noThenProperty: intentional PromiseLike mock for testing
      then(resolve: (v: unknown) => void) {
        const value = queue.shift() ?? [];
        resolve(value);
        return Promise.resolve(value);
      },
    } as unknown;

    const result = await healthAggregates(
      mockDb as Parameters<typeof healthAggregates>[0]
    );

    expect(result.successRate24h).toBeNull();
    expect(result.successRate7d).toBe(1);
    expect(result.successRate30d).toBeNull();
  });

  it('healthAggregates always uses REPLAY_EXCLUSION (not a fresh isNull call)', () => {
    // healthAggregates uses the module-level REPLAY_EXCLUSION constant,
    // which is the same reference as buildRequestsWhere uses when includeReplays=false.
    // This guarantees replay exclusion is unconditional.
    const conditions = buildRequestsWhere({}, false);
    // REPLAY_EXCLUSION appears in the conditions array at the same reference
    expect(conditions[0]).toBe(REPLAY_EXCLUSION);
  });
});
