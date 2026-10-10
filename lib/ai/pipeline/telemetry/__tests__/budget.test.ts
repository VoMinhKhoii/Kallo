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

  it('files each attempt under the provider that ran it', () => {
    const record = createBudgetAttemptRecorder({
      db,
      requestId: 'r1',
      workKind: 'primary',
      model: 'claude-haiku-5-5',
    });
    const attempt = {
      inputTokens: 100,
      outputTokens: 10,
      cachedTokens: 0,
      thoughtTokens: 0,
      error: new Error('429 rate limited'),
    };
    record({ ...attempt, attempt: 1, model: 'claude-haiku-5-5' });
    // The Gemini fallback of the same call.
    record({ ...attempt, attempt: 2, model: 'gemini-3.1-flash-lite' });

    expect(mockRecord).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ provider: 'anthropic' })
    );
    expect(mockRecord).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ provider: 'gemini' })
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
