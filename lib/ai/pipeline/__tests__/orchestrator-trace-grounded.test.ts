import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMockGemini,
  createSourceAwareMockDb,
} from '../../__tests__/test-helpers';
import type { UserContext } from '../../types';
import {
  DECOMPOSITION_TIMEOUT_MS,
  NUTRITION_TIMEOUT_MS,
} from '../config/stage-timeouts';
import type { GroundedEstimation, MealDecompositionV2 } from '../schemas-v2';

// Capture logStage calls — v2 must populate the same admin/audit timeline
// v1 populates so requests/[id] shows stages. buildLlmStageTrace is also
// imported by the orchestrator (used to record prompt versions for the
// admin prompts page); the mock returns undefined so the trace plumbing
// short-circuits without DB calls.
const mockLogStage = vi.fn();
const mockBuildLlmStageTrace = vi.fn().mockReturnValue(undefined);
vi.mock('../telemetry/trace', () => ({
  logStage: mockLogStage,
  buildLlmStageTrace: mockBuildLlmStageTrace,
}));

// Stub run-telemetry's writePipelineRun so we capture it without DB.
const mockWritePipelineRun = vi.fn().mockResolvedValue(undefined);
vi.mock('../telemetry/run-telemetry', async () => {
  const actual = await vi.importActual<
    typeof import('../telemetry/run-telemetry')
  >('../telemetry/run-telemetry');
  return {
    ...actual,
    writePipelineRun: mockWritePipelineRun,
  };
});

const { analyzeMealV2 } = await import('../grounded-orchestrator');

// Save process.env state once so afterEach can restore each mutation. The
// first test in this file sets PIPELINE_TRACE_ENABLED='true'; without this
// restore, later files in the same vitest run would inherit that mutation
// and become order-dependent.
const prevPipelineTraceEnabled = process.env.PIPELINE_TRACE_ENABLED;

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  if (prevPipelineTraceEnabled === undefined) {
    delete process.env.PIPELINE_TRACE_ENABLED;
  } else {
    process.env.PIPELINE_TRACE_ENABLED = prevPipelineTraceEnabled;
  }
});

const userContext: UserContext = {
  goal: 'maintaining',
  aggression: 0,
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  inputLanguage: 'vi',
  outputLanguage: 'vi',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    defaultProteinPortion: 'medium',
    sugarBraised: 'medium',
    brothConsumption: 'some',
  },
};

function geminiWith(call1: MealDecompositionV2, call2: GroundedEstimation) {
  let invocation = 0;
  return createMockGemini({
    generateStructuredOutputStream: vi.fn().mockImplementation(async () => {
      const out = invocation === 0 ? call1 : call2;
      invocation++;
      return out;
    }),
  });
}

describe('analyzeMealV2 — admin/audit observability', () => {
  it('writes one pipeline_stage_logs row per stage when traceContext is provided', async () => {
    const call1: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'cơm trắng',
          cookingMethod: 'nấu',
          ingredients: [{ rawName: 'cơm', canonicalName: 'Cơm' }],
        },
      ],
    };
    const call2: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'cơm trắng',
          ingredients: [
            {
              ingredientName: 'cơm',
              selectedCandidateId: 'none',
              grossG: 200,
              refusePct: 0,
              caloriesKcal: { low: 250, mid: 260, high: 270 },
              proteinG: { low: 5, mid: 5, high: 5 },
              carbohydrateG: { low: 55, mid: 56, high: 57 },
              fatG: { low: 0.5, mid: 0.6, high: 0.7 },
            },
          ],
        },
      ],
    };
    const gemini = geminiWith(call1, call2);
    const db = createSourceAwareMockDb({});
    const traceContext = {
      requestId: 'req-test-1',
      db,
      userId: 'user-1',
      promptVersionsUsed: new Map<string, string>(),
    };

    process.env.PIPELINE_TRACE_ENABLED = 'true';

    await analyzeMealV2('1 chén cơm', userContext, db, gemini, undefined, {
      traceContext,
    });

    const stagesLogged = mockLogStage.mock.calls.map((c) => c[0]);
    const stageNames = stagesLogged.map((s) => s.stage);
    expect(stageNames).toContain('decomposition');
    expect(stageNames).toContain('matching');
    expect(stageNames).toContain('nutrition');
    expect(stageNames).toContain('assembly');
    // All 4 successful.
    expect(stagesLogged.every((s) => s.status === 'success')).toBe(true);
    // All carry the same requestId.
    expect(stagesLogged.every((s) => s.requestId === 'req-test-1')).toBe(true);
    // stageIndex 1..4 in order.
    const indexes = stagesLogged.map((s) => s.stageIndex);
    expect(new Set(indexes)).toEqual(new Set([1, 2, 3, 4]));
  });

  it('does NOT write stage logs when traceContext is omitted', async () => {
    const call1: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'cơm',
          cookingMethod: 'nấu',
          ingredients: [{ rawName: 'cơm', canonicalName: 'Cơm' }],
        },
      ],
    };
    const call2: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'cơm',
          ingredients: [
            {
              ingredientName: 'cơm',
              selectedCandidateId: 'none',
              grossG: 200,
              refusePct: 0,
              caloriesKcal: { low: 250, mid: 260, high: 270 },
              proteinG: { low: 5, mid: 5, high: 5 },
              carbohydrateG: { low: 55, mid: 56, high: 57 },
              fatG: { low: 0.5, mid: 0.6, high: 0.7 },
            },
          ],
        },
      ],
    };
    await analyzeMealV2(
      'cơm',
      userContext,
      createSourceAwareMockDb({}),
      geminiWith(call1, call2)
    );

    expect(mockLogStage).not.toHaveBeenCalled();
  });

  it('writes a pipeline_runs row with v2_run anomaly marker when traceContext is provided', async () => {
    const call1: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'cơm',
          cookingMethod: 'nấu',
          ingredients: [{ rawName: 'cơm', canonicalName: 'Cơm' }],
        },
      ],
    };
    const call2: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'cơm',
          ingredients: [
            {
              ingredientName: 'cơm',
              selectedCandidateId: 'none',
              grossG: 200,
              refusePct: 0,
              caloriesKcal: { low: 250, mid: 260, high: 270 },
              proteinG: { low: 5, mid: 5, high: 5 },
              carbohydrateG: { low: 55, mid: 56, high: 57 },
              fatG: { low: 0.5, mid: 0.6, high: 0.7 },
            },
          ],
        },
      ],
    };
    const db = createSourceAwareMockDb({});
    let invocation = 0;
    const gemini = createMockGemini({
      generateStructuredOutputStream: vi
        .fn()
        .mockImplementation(async (_params, options) => {
          const out = invocation === 0 ? call1 : call2;
          if (invocation === 0) {
            options?.onAttemptStart?.(1);
            options?.onAttemptStart?.(2);
          } else {
            options?.onAttemptStart?.(1);
          }
          invocation++;
          return out;
        }),
    });
    await analyzeMealV2('cơm', userContext, db, gemini, undefined, {
      traceContext: {
        requestId: 'req-runs-1',
        db,
        userId: 'user-1',
        promptVersionsUsed: new Map<string, string>(),
      },
    });
    expect(mockWritePipelineRun).toHaveBeenCalled();
    const row = mockWritePipelineRun.mock.calls[0][1];
    expect(row.anomalyTypes).toContain('v2_run');
    expect(row.pipelineVersion).toBe('v2');
    expect(row.retryCount).toBe(1);
    expect(row.matchedCount).toBe(0);
    expect(row.unmatchedCount).toBe(1);
    expect(row.modelCall1).toBe('gemini-3.1-flash-lite');
    expect(row.modelCall2).toBe('gemini-3.1-flash-lite');
    expect(row.requestId).toBe('req-runs-1');
  });

  it('aborts Call 1 at the decomposition deadline and records the timeout', async () => {
    vi.useFakeTimers();
    const db = createSourceAwareMockDb({});
    let signal: AbortSignal | undefined;
    const gemini = createMockGemini({
      generateStructuredOutputStream: vi.fn().mockImplementation((params) => {
        signal = params.abortSignal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }),
    });

    const resultPromise = analyzeMealV2(
      'cơm',
      userContext,
      db,
      gemini,
      undefined,
      {
        traceContext: {
          requestId: 'req-timeout-call-1',
          db,
          userId: 'user-1',
          promptVersionsUsed: new Map<string, string>(),
        },
      }
    );
    await vi.advanceTimersByTimeAsync(DECOMPOSITION_TIMEOUT_MS);
    const result = await resultPromise;

    expect(signal?.aborted).toBe(true);
    expect(result).toEqual({
      success: false,
      error: {
        type: 'api_error',
        message: 'Analysis took too long. Please try again.',
        retryable: true,
      },
    });
    expect(mockLogStage).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-timeout-call-1',
        stage: 'decomposition',
        status: 'error',
        error: 'Analysis took too long. Please try again.',
      })
    );
    vi.useRealTimers();
  });

  it('aborts Call 2 at the nutrition deadline and records the timeout', async () => {
    vi.useFakeTimers();
    const call1: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'cơm',
          cookingMethod: 'nấu',
          ingredients: [{ rawName: 'cơm', canonicalName: 'Cơm' }],
        },
      ],
    };
    const db = createSourceAwareMockDb({});
    let invocation = 0;
    let nutritionSignal: AbortSignal | undefined;
    const gemini = createMockGemini({
      generateStructuredOutputStream: vi
        .fn()
        .mockImplementation((params, options) => {
          options?.onAttemptStart?.(1);
          invocation++;
          if (invocation === 1) return Promise.resolve(call1);
          nutritionSignal = params.abortSignal;
          return new Promise((_resolve, reject) => {
            nutritionSignal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          });
        }),
    });

    const resultPromise = analyzeMealV2(
      'cơm',
      userContext,
      db,
      gemini,
      undefined,
      {
        traceContext: {
          requestId: 'req-timeout-call-2',
          db,
          userId: 'user-1',
          promptVersionsUsed: new Map<string, string>(),
        },
      }
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(invocation).toBe(2);
    await vi.advanceTimersByTimeAsync(NUTRITION_TIMEOUT_MS);
    const result = await resultPromise;

    expect(nutritionSignal?.aborted).toBe(true);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toEqual({
        type: 'api_error',
        message: 'Analysis took too long. Please try again.',
        retryable: true,
      });
    }
    expect(mockLogStage).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-timeout-call-2',
        stage: 'nutrition',
        status: 'error',
        error: 'Analysis took too long. Please try again.',
      })
    );
    vi.useRealTimers();
  });
});
