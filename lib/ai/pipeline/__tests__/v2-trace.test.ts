import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMockGemini,
  createSourceAwareMockDb,
} from '../../__tests__/test-helpers';
import type { UserContext } from '../../types';
import type { GroundedEstimation, MealDecompositionV2 } from '../schemas';

// Capture logStage calls — v2 must populate the same admin/audit timeline
// v1 populates so requests/[id] shows stages.
const mockLogStage = vi.fn();
vi.mock('../trace', () => ({
  logStage: mockLogStage,
}));

// Stub run-telemetry's writePipelineRun so we capture it without DB.
const mockWritePipelineRun = vi.fn().mockResolvedValue(undefined);
vi.mock('../run-telemetry', async () => {
  const actual =
    await vi.importActual<typeof import('../run-telemetry')>(
      '../run-telemetry'
    );
  return {
    ...actual,
    writePipelineRun: mockWritePipelineRun,
  };
});

const { analyzeMealV2 } = await import('../v2-orchestrator');

afterEach(() => {
  vi.clearAllMocks();
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
              grams: 200,
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
              grams: 200,
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
              grams: 200,
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
    await analyzeMealV2(
      'cơm',
      userContext,
      db,
      geminiWith(call1, call2),
      undefined,
      {
        traceContext: {
          requestId: 'req-runs-1',
          db,
          userId: 'user-1',
          promptVersionsUsed: new Map<string, string>(),
        },
      }
    );
    expect(mockWritePipelineRun).toHaveBeenCalled();
    const row = mockWritePipelineRun.mock.calls[0][1];
    expect(row.anomalyTypes).toContain('v2_run');
    expect(row.modelCall1).toBe('gemini-3.1-flash-lite');
    expect(row.modelCall2).toBe('gemini-3.1-flash-lite');
    expect(row.requestId).toBe('req-runs-1');
  });
});
