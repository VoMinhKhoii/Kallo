import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { recordAnalysisModelBudgetEvent } = await import(
  '../model-budget-events'
);

const fixedNow = new Date('2026-05-07T12:34:15.250Z');

describe('recordAnalysisModelBudgetEvent', () => {
  it('records only operational budget metadata', async () => {
    const rows: unknown[] = [];
    const db = {
      insert: () => ({
        values: async (row: unknown) => {
          rows.push(row);
        },
      }),
    } as unknown as NonNullable<
      Parameters<typeof recordAnalysisModelBudgetEvent>[0]['db']
    >;

    await recordAnalysisModelBudgetEvent({
      db,
      now: () => fixedNow,
      requestId: 'request-1',
      route: '/api/analyze-meal',
      workKind: 'shadow',
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      requestCount: 1,
      inputTokens: 120,
      outputTokens: 80,
      errorCategory: null,
      rawInput: 'phở bò tái chín',
      userId: 'user-1',
    } as Parameters<typeof recordAnalysisModelBudgetEvent>[0] & {
      rawInput: string;
      userId: string;
    });

    const [event] = rows;
    expect(event).toMatchObject({
      createdAt: fixedNow,
      requestId: 'request-1',
      route: '/api/analyze-meal',
      workKind: 'shadow',
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      requestCount: 1,
      inputTokens: 120,
      outputTokens: 80,
      errorCategory: null,
    });
    expect(event).not.toHaveProperty('rawInput');
    expect(event).not.toHaveProperty('userId');
    expect(JSON.stringify(event)).not.toContain('phở bò tái chín');
    expect(JSON.stringify(event)).not.toContain('user-1');
  });

  it('keeps an unknown cost null, never zero', async () => {
    const rows: Record<string, unknown>[] = [];
    const db = {
      insert: () => ({
        values: async (row: Record<string, unknown>) => {
          rows.push(row);
        },
      }),
    } as unknown as NonNullable<
      Parameters<typeof recordAnalysisModelBudgetEvent>[0]['db']
    >;

    await recordAnalysisModelBudgetEvent({
      db,
      route: '/api/analyze-meal',
      workKind: 'primary',
      provider: 'gemini',
      costUsd: null,
      requestCount: -1,
    });

    expect(rows[0]).toMatchObject({ costUsd: null, requestCount: 1 });
  });
});
