import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cloudTrace } from '@/lib/ai/pipeline/telemetry/cloud-trace/cloud-trace';
import type { GeminiAttemptMetadata } from '@/lib/ai/provider/types';
import type { RecordAnalysisModelBudgetEventInput } from '@/lib/infra/rate-limit/analysis-guard-types';

const { mockRecord } = vi.hoisted(() => ({
  mockRecord: vi.fn((_input: RecordAnalysisModelBudgetEventInput) =>
    Promise.resolve()
  ),
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
afterEach(() => vi.restoreAllMocks());

/** One finished attempt; tests override what they look at. */
function attemptOf(
  overrides: Partial<GeminiAttemptMetadata> = {}
): GeminiAttemptMetadata {
  return {
    attempt: 1,
    model: 'm',
    inputTokens: 1,
    outputTokens: 1,
    cachedTokens: null,
    cacheWriteTokens: null,
    thoughtTokens: null,
    latencyMs: 1200,
    error: null,
    ...overrides,
  };
}

describe('createBudgetAttemptRecorder', () => {
  beforeEach(() => mockRecord.mockClear());

  it('emits exactly one LLM event for each billed Claude/retry/Gemini fallback attempt', () => {
    const emit = vi.spyOn(cloudTrace, 'emit');
    const record = createBudgetAttemptRecorder({
      db,
      requestId: 'synthetic',
      workKind: 'primary',
      model: 'claude-haiku-5-5',
      stage: 'decomposition',
    });
    const attempts = [
      attemptOf({
        model: 'claude-haiku-5-5',
        attempt: 1,
        error: new Error('schema'),
        response: '{"synthetic":1}',
      }),
      attemptOf({
        model: 'claude-haiku-5-5',
        attempt: 2,
        error: new Error('503'),
        cachedTokens: 4,
      }),
      attemptOf({
        model: 'gemini-3.1-flash-lite',
        attempt: 3,
        fallbackFrom: 'claude-haiku-5-5',
        response: '{"synthetic":3}',
      }),
    ];
    for (const attempt of attempts) expect(record(attempt)).toBeUndefined();
    expect(mockRecord).toHaveBeenCalledTimes(3);
    expect(emit).toHaveBeenCalledTimes(3);
    attempts.forEach((attempt, index) => {
      const billed = mockRecord.mock.calls[index][0];
      expect(emit).toHaveBeenNthCalledWith(
        index + 1,
        'synthetic',
        'llm',
        expect.objectContaining({
          stage: 'decomposition',
          attempt: attempt.attempt,
          model: billed.model,
          provider: billed.provider,
          inputTokens: billed.inputTokens,
          outputTokens: billed.outputTokens,
          costUsd: billed.costUsd,
          cachedTokens: billed.cachedTokens,
          latencyMs: billed.latencyMs,
          response: attempt.response ?? null,
          fallbackFrom: attempt.fallbackFrom ?? null,
        })
      );
    });
  });

  it('forwards cached and thinking tokens with the attempt', () => {
    const record = createBudgetAttemptRecorder({
      db,
      requestId: 'r1',
      workKind: 'primary',
      model: 'fallback-model',
    });
    record(
      attemptOf({
        model: 'gemini-3.1-flash-lite',
        inputTokens: 6500,
        outputTokens: 700,
        cachedTokens: 6000,
        thoughtTokens: 120,
      })
    );

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

  it('prices the attempt from the rate card and keeps its latency', () => {
    createBudgetAttemptRecorder({
      db,
      requestId: 'r1',
      workKind: 'primary',
      model: 'claude-haiku-5-5',
    })(
      attemptOf({
        model: 'claude-haiku-5-5',
        inputTokens: 5_000,
        cachedTokens: 1_000,
        cacheWriteTokens: 3_000,
        outputTokens: 400,
        latencyMs: 2_345,
      })
    );

    const row = (mockRecord.mock.calls as unknown as unknown[][])[0]?.[0] as {
      costUsd: number;
      latencyMs: number;
      cacheWriteTokens: number;
      fallbackFrom: string | null;
    };
    // 1000 fresh × 0.10 + 1000 cached × 0.01 + 3000 written × 0.125 + 400 × 0.50.
    expect(row.costUsd).toBeCloseTo(0.000685, 10);
    expect(row.latencyMs).toBe(2_345);
    expect(row.cacheWriteTokens).toBe(3_000);
    expect(row.fallbackFrom).toBeNull();
  });

  it('files each attempt under the provider that ran it, marking the fallback', () => {
    const record = createBudgetAttemptRecorder({
      db,
      requestId: 'r1',
      workKind: 'primary',
      model: 'claude-haiku-5-5',
    });
    const failed = attemptOf({
      inputTokens: 100,
      outputTokens: 10,
      error: new Error('429 rate limited'),
    });
    record({ ...failed, attempt: 1, model: 'claude-haiku-5-5' });
    // The Gemini fallback of the same call.
    record(
      attemptOf({
        attempt: 2,
        model: 'gemini-3.1-flash-lite',
        fallbackFrom: 'claude-haiku-5-5',
      })
    );

    expect(mockRecord).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        provider: 'anthropic',
        errorCategory: 'rate_limit',
        fallbackFrom: null,
      })
    );
    expect(mockRecord).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        provider: 'gemini',
        fallbackFrom: 'claude-haiku-5-5',
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
    })(attemptOf());

    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ route: CHEAT_BUDGET_ROUTE })
    );
  });

  it('records an attempt with no usage, its cost unknown rather than zero', () => {
    createBudgetAttemptRecorder({
      db,
      requestId: null,
      workKind: 'primary',
      model: 'gemini-3.1-flash-lite',
    })(
      attemptOf({
        model: 'gemini-3.1-flash-lite',
        inputTokens: null,
        outputTokens: null,
      })
    );

    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ requestCount: 0, costUsd: null })
    );
  });

  it('prices an unpriced model as null', () => {
    createBudgetAttemptRecorder({
      db,
      requestId: null,
      workKind: 'primary',
      model: 'm',
    })(attemptOf({ model: 'some-new-model', inputTokens: 900 }));

    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ costUsd: null })
    );
  });

  it('files a failure no provider category fits as unknown, without marking provider pressure', () => {
    const providerErrorState = { recorded: false };
    const slip = new Error('fewer meal items than the plan numbers');
    slip.name = 'ZodError';
    createBudgetAttemptRecorder({
      db,
      requestId: null,
      workKind: 'primary',
      model: 'm',
      providerErrorState,
    })(attemptOf({ error: slip }));

    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ errorCategory: 'unknown' })
    );
    expect(providerErrorState.recorded).toBe(false);
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

    record(
      attemptOf({
        model: 'gemini-3.1-flash-lite',
        inputTokens: 900,
        outputTokens: 200,
        thoughtTokens: 1500,
      })
    );

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
