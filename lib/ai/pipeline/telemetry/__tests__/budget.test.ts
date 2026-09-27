import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRecord } = vi.hoisted(() => ({
  mockRecord: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/infra/rate-limit/analysis-model-budget', () => ({
  recordAnalysisModelBudgetEvent: mockRecord,
}));

import {
  ANALYSIS_MODEL_BUDGET_ROUTE,
  CHEAT_BUDGET_ROUTE,
  createBudgetAttemptRecorder,
  initCheatBudgetAccounting,
} from '../budget';

const db = {} as never;

describe('createBudgetAttemptRecorder', () => {
  beforeEach(() => mockRecord.mockClear());

  it('forwards cached and thinking tokens with the attempt', () => {
    const record = createBudgetAttemptRecorder({
      db,
      requestId: 'r1',
      workKind: 'primary',
      model: 'fallback-model',
    });
    record({
      attempt: 1,
      model: 'gemini-3.1-flash-lite',
      inputTokens: 6500,
      outputTokens: 700,
      cachedTokens: 6000,
      thoughtTokens: 120,
      error: null,
    });

    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        route: ANALYSIS_MODEL_BUDGET_ROUTE,
        model: 'gemini-3.1-flash-lite',
        requestCount: 0,
        inputTokens: 6500,
        outputTokens: 700,
        cachedTokens: 6000,
        thoughtTokens: 120,
        errorCategory: null,
      })
    );
  });

  it('tags non-meal callers with their own route', () => {
    createBudgetAttemptRecorder({
      db,
      requestId: null,
      workKind: 'primary',
      model: 'm',
      route: CHEAT_BUDGET_ROUTE,
    })({
      attempt: 1,
      model: 'm',
      inputTokens: 1,
      outputTokens: 1,
      cachedTokens: null,
      thoughtTokens: null,
      error: null,
    });

    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ route: CHEAT_BUDGET_ROUTE })
    );
  });

  it('writes nothing for an attempt with no tokens and no classified error', () => {
    createBudgetAttemptRecorder({
      db,
      requestId: null,
      workKind: 'primary',
      model: 'm',
    })({
      attempt: 1,
      model: 'm',
      inputTokens: null,
      outputTokens: null,
      cachedTokens: null,
      thoughtTokens: null,
      error: null,
    });

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('reserves one request for a cheat analysis and records its attempts under the cheat route', () => {
    const record = initCheatBudgetAccounting({
      db,
      requestId: 'r2',
      model: 'gemini-3.1-flash-lite',
    });

    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord).toHaveBeenLastCalledWith(
      expect.objectContaining({
        requestId: 'r2',
        route: CHEAT_BUDGET_ROUTE,
        workKind: 'primary',
        requestCount: 1,
      })
    );

    record({
      attempt: 1,
      model: 'gemini-3.1-flash-lite',
      inputTokens: 900,
      outputTokens: 200,
      cachedTokens: null,
      thoughtTokens: 1500,
      error: null,
    });

    expect(mockRecord).toHaveBeenCalledTimes(2);
    expect(mockRecord).toHaveBeenLastCalledWith(
      expect.objectContaining({
        route: CHEAT_BUDGET_ROUTE,
        requestCount: 0,
        thoughtTokens: 1500,
      })
    );
  });
});
