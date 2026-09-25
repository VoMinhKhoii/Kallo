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
      error: null,
    });

    expect(mockRecord).not.toHaveBeenCalled();
  });
});
