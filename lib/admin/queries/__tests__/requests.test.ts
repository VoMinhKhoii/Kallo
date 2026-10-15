import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
  buildRequestsWhere,
  getRequestDetail,
  REPLAY_EXCLUSION,
  requestFiltersSchema,
} from '@/lib/admin/queries/requests';
import type { AppDb } from '@/lib/infra/db/client';
import {
  pipelineLlmCalls,
  pipelineRequests,
  pipelineStageLogs,
} from '@/lib/infra/db/schema';

it('request detail falls back to the prompt version template while preserving distinct rendered prompts', async () => {
  let callProjection: Record<string, unknown> = {};
  const select = vi.fn((projection?: Record<string, unknown>) => ({
    from(table: unknown) {
      if (table === pipelineLlmCalls) callProjection = projection ?? {};
      const rows =
        table === pipelineRequests
          ? [{ id: 'synthetic' }]
          : table === pipelineStageLogs
            ? []
            : [
                {
                  call: { id: 'template', promptRendered: null },
                  promptRendered: 'Synthetic template',
                  metadata: null,
                },
                {
                  call: {
                    id: 'rendered',
                    promptRendered: 'Synthetic rendered',
                  },
                  promptRendered: 'Synthetic rendered',
                  metadata: null,
                },
              ];
      const chain = {
        leftJoin: vi.fn(() => chain),
        where: vi.fn(() => chain),
        limit: vi.fn(async () => rows),
        orderBy: vi.fn(async () => rows),
      };
      return chain;
    },
  }));
  const detail = await getRequestDetail(
    { select } as unknown as AppDb,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  );
  expect(
    new PgDialect().sqlToQuery(
      callProjection.promptRendered as import('drizzle-orm').SQL
    ).sql
  ).toMatch(
    /coalesce\("pipeline_llm_calls"\."prompt_rendered", "prompt_versions"\."template_sample"\)/
  );
  expect(detail?.llmCalls.map((call) => call.promptRendered)).toEqual([
    'Synthetic template',
    'Synthetic rendered',
  ]);
});

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

  it("transforms status='all' to undefined (UI affordance)", () => {
    const result = requestFiltersSchema.parse({ status: 'all' });
    expect(result.status).toBeUndefined();
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
