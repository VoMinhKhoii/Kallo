import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/lib/db';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const {
  mockLogStage,
  mockLogLlmCall,
  mockRecordPromptVersion,
  mockMatchIngredients,
  mockAssembleResult,
  mockValidateNutritionOutput,
  mockDetectAnomalies,
  mockDbInsert,
  mockDbValues,
} = vi.hoisted(() => ({
  mockLogStage: vi.fn(),
  mockLogLlmCall: vi.fn(),
  mockRecordPromptVersion: vi.fn().mockResolvedValue('pv-test-id'),
  mockMatchIngredients: vi.fn(),
  mockAssembleResult: vi.fn(),
  mockValidateNutritionOutput: vi.fn(),
  mockDetectAnomalies: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbValues: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/ai/pipeline/trace', () => ({
  logStage: mockLogStage,
  logLlmCall: mockLogLlmCall,
  recordPromptVersion: mockRecordPromptVersion,
  buildLlmStageTrace: vi.fn(
    async (args: {
      trace?: { promptVersionsUsed: Map<string, string> };
      stageLogId: string;
      name: 'decomposition' | 'nutrition';
      builder: (...a: unknown[]) => string;
      templateSample: string;
      model: string;
    }) => {
      if (!args.trace) return undefined;
      const pvId = await mockRecordPromptVersion({
        name: args.name,
        builder: args.builder,
        templateSample: args.templateSample,
        model: args.model,
      });
      if (!pvId) return undefined;
      args.trace.promptVersionsUsed.set(args.name, pvId);
      return {
        db: {} as unknown,
        requestId: 'test-request-id',
        stageLogId: args.stageLogId,
        promptVersionId: pvId,
        promptRendered: args.templateSample,
      };
    }
  ),
  _resetPromptVersionCacheForTests: vi.fn(),
}));

vi.mock('@/lib/fetch-with-timeout', () => ({
  fetchWithTimeout: (fn: (signal: AbortSignal) => unknown) =>
    fn(new AbortController().signal),
}));

vi.mock('@/lib/ai/matching', () => ({
  matchIngredients: mockMatchIngredients,
  logUnmatchedIngredients: vi.fn(),
}));

vi.mock('@/lib/ai/matching/speculative', () => ({
  createSpeculativeMatcher: vi.fn().mockReturnValue(() => {}),
}));

vi.mock('@/lib/ai/pipeline/assembly', () => ({
  assembleResult: mockAssembleResult,
}));

vi.mock('@/lib/ai/pipeline/validation', () => ({
  validateNutritionOutput: mockValidateNutritionOutput,
  detectAnomalies: mockDetectAnomalies,
  classifyAnomalies: vi.fn().mockReturnValue('pass'),
  THRESHOLDS: { MIN_TOTAL_KCAL: 1 },
}));

vi.mock('@/lib/ai/streaming/parsers', () => ({
  computeStreamingMealItem: vi.fn().mockReturnValue({}),
  extractCompletedMealItemNutrition: vi
    .fn()
    .mockReturnValue({ items: [], newCount: 0 }),
  extractMealItemNames: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/ai/prompts', () => ({
  buildDecompositionPrompt: vi.fn().mockReturnValue('decomp-system-prompt'),
  buildNutritionPrompt: vi.fn().mockReturnValue('nutrition-system-prompt'),
}));

import { createMockGemini } from '@/lib/ai/__tests__/test-helpers';
import type { UserContext } from '@/lib/ai/types';
import type { AnalyzeMealTraceContext } from '../orchestrator';
// Import after mocks
import { analyzeMeal } from '../orchestrator';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const USER_CONTEXT: UserContext = {
  goal: 'maintaining',
  aggression: 0.5,
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    sugarBraised: 'medium',
    defaultProteinPortion: 'medium',
    brothConsumption: 'some',
  },
};

const VALID_DECOMP = {
  isFood: true,
  mealItems: [
    {
      name: 'cơm',
      ingredients: [
        {
          name: 'gạo',
          estimatedGrams: 200,
          cookingMethod: null,
          userFacingUnit: null,
        },
      ],
    },
  ],
  mealSlot: null,
};

const VALID_NUTRITION = {
  mealItems: [
    {
      mealItemName: 'Cơm',
      ingredients: [
        {
          ingredientName: 'Gạo',
          caloriesKcal: { low: 250, mid: 300, high: 360 },
          proteinG: { low: 5, mid: 6, high: 8 },
          carbohydrateG: { low: 50, mid: 65, high: 80 },
          fatG: { low: 0.3, mid: 0.5, high: 1 },
        },
      ],
    },
  ],
};

function makeDb(): AppDb {
  mockDbInsert.mockReturnValue({ values: mockDbValues });
  return { insert: mockDbInsert } as unknown as AppDb;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('analyzeMeal traceContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordPromptVersion.mockResolvedValue('pv-test-id');
    mockMatchIngredients.mockResolvedValue({ matched: [], unmatched: [] });
    mockAssembleResult.mockReturnValue({ mealItems: [] });
    mockValidateNutritionOutput.mockReturnValue([]);
    mockDetectAnomalies.mockReturnValue([]);
    mockDbValues.mockResolvedValue(undefined);
  });

  it('calls logStage 4 times and recordPromptVersion 2 times when traceContext provided', async () => {
    const db = makeDb();
    const promptVersionsUsed = new Map<string, string>();
    const traceContext: AnalyzeMealTraceContext = {
      requestId: 'req-001',
      db,
      userId: 'user-test-1',
      promptVersionsUsed,
    };

    const gemini = createMockGemini({
      generateStructuredOutputStream: vi
        .fn()
        .mockResolvedValueOnce(VALID_DECOMP)
        .mockResolvedValueOnce(VALID_NUTRITION),
    });

    const result = await analyzeMeal(
      'cơm trắng',
      USER_CONTEXT,
      db,
      gemini,
      undefined,
      traceContext
    );

    expect(result.success).toBe(true);
    expect(mockLogStage).toHaveBeenCalledTimes(4);

    type StageCall = { stageIndex: number; stage: string; status: string };
    const stageArgs = mockLogStage.mock.calls.map(
      (call) => call[0] as StageCall
    );
    expect(stageArgs.map((a) => a.stageIndex)).toEqual([1, 2, 3, 4]);
    expect(stageArgs.map((a) => a.stage)).toEqual([
      'decomposition',
      'matching',
      'nutrition',
      'assembly',
    ]);
    expect(stageArgs.every((a) => a.status === 'success')).toBe(true);

    expect(mockRecordPromptVersion).toHaveBeenCalledTimes(2);
    expect(promptVersionsUsed.size).toBe(2);
    expect(promptVersionsUsed.has('decomposition')).toBe(true);
    expect(promptVersionsUsed.has('nutrition')).toBe(true);
    expect(promptVersionsUsed.get('decomposition')).toBe('pv-test-id');
    expect(promptVersionsUsed.get('nutrition')).toBe('pv-test-id');
  });

  it('does not call logStage or recordPromptVersion when no traceContext', async () => {
    const db = makeDb();
    const gemini = createMockGemini({
      generateStructuredOutputStream: vi
        .fn()
        .mockResolvedValueOnce(VALID_DECOMP)
        .mockResolvedValueOnce(VALID_NUTRITION),
    });

    await analyzeMeal('cơm trắng', USER_CONTEXT, db, gemini, undefined);

    expect(mockLogStage).not.toHaveBeenCalled();
    expect(mockRecordPromptVersion).not.toHaveBeenCalled();
  });

  it('logs stage 1 success and stage 2 error when matching throws', async () => {
    const db = makeDb();
    const promptVersionsUsed = new Map<string, string>();
    const traceContext: AnalyzeMealTraceContext = {
      requestId: 'req-err',
      db,
      userId: 'user-test-1',
      promptVersionsUsed,
    };

    mockMatchIngredients.mockRejectedValueOnce(
      new Error('DB connection failed')
    );

    const gemini = createMockGemini({
      generateStructuredOutputStream: vi
        .fn()
        .mockResolvedValueOnce(VALID_DECOMP),
    });

    const result = await analyzeMeal(
      'cơm trắng',
      USER_CONTEXT,
      db,
      gemini,
      undefined,
      traceContext
    );

    // analyzeMeal returns { success: false } for unhandled errors
    expect(result.success).toBe(false);

    // Stage 1 logged as success, stage 2 as error; stages 3 & 4 not reached
    expect(mockLogStage).toHaveBeenCalledTimes(2);
    expect(mockLogStage.mock.calls[0][0].stageIndex).toBe(1);
    expect(mockLogStage.mock.calls[0][0].status).toBe('success');
    expect(mockLogStage.mock.calls[1][0].stageIndex).toBe(2);
    expect(mockLogStage.mock.calls[1][0].status).toBe('error');
  });

  it('aggregates density_envelope and macro_inconsistent warnings into pipeline_runs counters', async () => {
    const db = makeDb();
    const promptVersionsUsed = new Map<string, string>();
    const traceContext: AnalyzeMealTraceContext = {
      requestId: 'req-counters',
      db,
      userId: 'user-test-1',
      promptVersionsUsed,
    };

    mockValidateNutritionOutput.mockReturnValue([
      {
        type: 'density_envelope',
        message: 'density breach',
        severity: 'warning',
      },
      {
        type: 'macro_inconsistent',
        message: 'macro breach',
        severity: 'warning',
      },
      {
        type: 'macro_inconsistent',
        message: 'macro breach 2',
        severity: 'warning',
      },
    ]);

    const gemini = createMockGemini({
      generateStructuredOutputStream: vi
        .fn()
        .mockResolvedValueOnce(VALID_DECOMP)
        .mockResolvedValueOnce(VALID_NUTRITION),
    });

    await analyzeMeal(
      'cơm trắng',
      USER_CONTEXT,
      db,
      gemini,
      undefined,
      traceContext
    );

    expect(mockDbValues).toHaveBeenCalledTimes(1);
    const row = mockDbValues.mock.calls[0][0];
    expect(row.densityEnvelopeFires).toBe(1);
    expect(row.macroInconsistentFires).toBe(2);
    expect(row.anomalyTypes).toContain('density_envelope');
    expect(row.anomalyTypes).toContain('macro_inconsistent');
  });
});
