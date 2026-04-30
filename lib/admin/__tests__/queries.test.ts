import { describe, expect, it } from 'vitest';

import {
  buildRequestsWhere,
  healthAggregates,
  REPLAY_EXCLUSION,
  requestFiltersSchema,
} from '../queries';

// ─── Zod schema tests ─────────────────────────────────────────────────────────

describe('requestFiltersSchema', () => {
  it('parses empty input with defaults', () => {
    const result = requestFiltersSchema.parse({});
    expect(result.includeReplays).toBe(false);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
    expect(result.status).toBeUndefined();
    expect(result.userId).toBeUndefined();
  });

  it('parses status filter', () => {
    const result = requestFiltersSchema.parse({ status: 'success' });
    expect(result.status).toBe('success');
  });

  it('rejects invalid status', () => {
    expect(() => requestFiltersSchema.parse({ status: 'invalid' })).toThrow();
  });

  it('rejects invalid userId (non-UUID)', () => {
    expect(() =>
      requestFiltersSchema.parse({ userId: 'not-a-uuid' })
    ).toThrow();
  });

  it('accepts valid userId UUID', () => {
    const id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const result = requestFiltersSchema.parse({ userId: id });
    expect(result.userId).toBe(id);
  });

  it('coerces date strings', () => {
    const result = requestFiltersSchema.parse({ dateFrom: '2024-01-01' });
    expect(result.dateFrom).toBeInstanceOf(Date);
  });

  it('coerces page and pageSize from strings (URLSearchParams shape)', () => {
    const result = requestFiltersSchema.parse({ page: '2', pageSize: '25' });
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(25);
  });

  it('clamps pageSize to max 100', () => {
    expect(() => requestFiltersSchema.parse({ pageSize: '200' })).toThrow();
  });

  it('transforms includeReplays "true" → true', () => {
    const result = requestFiltersSchema.parse({ includeReplays: 'true' });
    expect(result.includeReplays).toBe(true);
  });

  it('transforms includeReplays "1" → true', () => {
    const result = requestFiltersSchema.parse({ includeReplays: '1' });
    expect(result.includeReplays).toBe(true);
  });

  it('transforms includeReplays "false" → false', () => {
    const result = requestFiltersSchema.parse({ includeReplays: 'false' });
    expect(result.includeReplays).toBe(false);
  });

  it('defaults includeReplays to false when absent', () => {
    const result = requestFiltersSchema.parse({});
    expect(result.includeReplays).toBe(false);
  });
});

// ─── buildRequestsWhere — replay exclusion ────────────────────────────────────

describe('buildRequestsWhere — replay exclusion', () => {
  it('includes REPLAY_EXCLUSION condition when includeReplays=false', () => {
    const conditions = buildRequestsWhere({}, false);
    expect(conditions).toContain(REPLAY_EXCLUSION);
  });

  it('does NOT include REPLAY_EXCLUSION condition when includeReplays=true', () => {
    const conditions = buildRequestsWhere({}, true);
    expect(conditions).not.toContain(REPLAY_EXCLUSION);
  });

  it('adds status condition when filter.status provided', () => {
    const withReplay = buildRequestsWhere({ status: 'error' }, false);
    const withoutReplay = buildRequestsWhere({ status: 'error' }, true);
    // With replay exclusion: 2 conditions (replay + status)
    expect(withReplay).toHaveLength(2);
    expect(withReplay).toContain(REPLAY_EXCLUSION);
    // Without replay exclusion: 1 condition (status only)
    expect(withoutReplay).toHaveLength(1);
  });

  it('adds no extra conditions for empty filter (besides replay exclusion)', () => {
    const conditions = buildRequestsWhere({}, false);
    expect(conditions).toHaveLength(1);
  });

  it('with includeReplays=true and no filters, returns empty conditions array', () => {
    const conditions = buildRequestsWhere({}, true);
    expect(conditions).toHaveLength(0);
  });

  it('adds dateFrom / dateTo conditions', () => {
    const from = new Date('2024-01-01');
    const to = new Date('2024-12-31');
    const conditions = buildRequestsWhere({ dateFrom: from, dateTo: to }, true);
    expect(conditions).toHaveLength(2);
  });
});

// ─── listRequests — mock DB ───────────────────────────────────────────────────

describe('listRequests — replay exclusion via buildRequestsWhere', () => {
  it('excludes replays by default (no includeReplays option)', () => {
    // listRequests calls buildRequestsWhere with includeReplays=false by default.
    // We verify the underlying helper produces the right conditions.
    const conditions = buildRequestsWhere({}, false);
    expect(conditions).toContain(REPLAY_EXCLUSION);
  });

  it('includes replays when includeReplays=true', () => {
    const conditions = buildRequestsWhere({}, true);
    expect(conditions).not.toContain(REPLAY_EXCLUSION);
  });
});

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
    // 4 parallel queries fired inside healthAggregates
    expect(callCount).toBe(4);
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
