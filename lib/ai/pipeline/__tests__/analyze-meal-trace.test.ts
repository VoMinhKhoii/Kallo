import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/lib/infra/db';

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

vi.mock('@/lib/ai/pipeline/telemetry/trace', () => ({
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

vi.mock('@/lib/core/async/fetch-with-timeout', () => ({
  fetchWithTimeout: (fn: (signal: AbortSignal) => unknown) =>
    fn(new AbortController().signal),
}));

vi.mock('@/lib/ai/matching/retrieve/legacy/cascade', () => ({
  matchIngredients: mockMatchIngredients,
}));

vi.mock('@/lib/ai/matching/unmatched-log', () => ({
  logUnmatchedIngredients: vi.fn(),
}));

vi.mock('@/lib/ai/matching/speculative', () => ({
  createSpeculativeMatcher: vi.fn().mockReturnValue(() => {}),
}));

vi.mock('@/lib/ai/pipeline/assemble/assemble', () => ({
  assembleResult: mockAssembleResult,
}));

vi.mock('@/lib/ai/pipeline/legacy/validation', () => ({
  validateDecompositionOutput: vi.fn().mockReturnValue([]),
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
  extractMealItemNameOccurrences: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/ai/prompts/build/decomposition', () => ({
  buildDecompositionPrompt: vi.fn().mockReturnValue('decomp-system-prompt'),
  getDecompositionPromptBuilder: vi
    .fn()
    .mockReturnValue(vi.fn().mockReturnValue('decomp-system-prompt')),
}));

vi.mock('@/lib/ai/prompts/build/nutrition', () => ({
  buildNutritionPrompt: vi.fn().mockReturnValue('nutrition-system-prompt'),
  getNutritionPromptBuilder: vi
    .fn()
    .mockReturnValue(vi.fn().mockReturnValue('nutrition-system-prompt')),
}));

import { createMockGemini } from '@/lib/ai/__fixtures__/test-helpers';
import type { AnalyzeMealTraceContext } from '@/lib/ai/pipeline/analyze-meal';
// Import after mocks
import {
  _resetL4DecompositionCacheForTests,
  analyzeMeal,
} from '@/lib/ai/pipeline/analyze-meal';
import type { UserContext } from '@/lib/ai/types/user-context';
import { analysisModelBudgetEvents, pipelineRuns } from '@/lib/infra/db/schema';

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

const FULL_PIPELINE_RESULT = {
  mealItems: [
    {
      name: 'Cơm',
      ingredients: [
        {
          ingredientName: 'Gạo',
          foodCompositionId: 'food-1',
          estimatedGrams: 200,
          rawEquivalentGrams: 200,
          cookingMethod: null,
          userFacingUnit: null,
          matchConfidence: 0.9,
          boundedNutrition: {
            caloriesKcal: { low: 250, mid: 300, high: 360 },
            proteinG: { low: 5, mid: 6, high: 8 },
            carbohydrateG: { low: 50, mid: 65, high: 80 },
            fatG: { low: 0.3, mid: 0.5, high: 1 },
          },
          displayedNutrition: {
            caloriesKcal: 300,
            proteinG: 6,
            carbohydrateG: 65,
            fatG: 0.5,
          },
        },
      ],
      boundedNutrition: {
        caloriesKcal: { low: 250, mid: 300, high: 360 },
        proteinG: { low: 5, mid: 6, high: 8 },
        carbohydrateG: { low: 50, mid: 65, high: 80 },
        fatG: { low: 0.3, mid: 0.5, high: 1 },
      },
      displayedNutrition: {
        caloriesKcal: 300,
        proteinG: 6,
        carbohydrateG: 65,
        fatG: 0.5,
      },
    },
  ],
  mealSlot: null,
  confidenceOverall: 'medium',
  boundedNutrition: {
    caloriesKcal: { low: 250, mid: 300, high: 360 },
    proteinG: { low: 5, mid: 6, high: 8 },
    carbohydrateG: { low: 50, mid: 65, high: 80 },
    fatG: { low: 0.3, mid: 0.5, high: 1 },
  },
  displayedNutrition: {
    caloriesKcal: 300,
    proteinG: 6,
    carbohydrateG: 65,
    fatG: 0.5,
  },
  unmatchedIngredients: [],
};

function makeDb(): AppDb {
  mockDbInsert.mockReturnValue({
    values: (row: unknown) => {
      mockDbValues(row);
      return { returning: vi.fn().mockResolvedValue([{ id: 'inserted-id' }]) };
    },
  });
  return { insert: mockDbInsert } as unknown as AppDb;
}

function insertedRowsFor(table: unknown) {
  return mockDbValues.mock.calls
    .map((call, index) => ({
      row: call[0],
      table: mockDbInsert.mock.calls[index]?.[0],
    }))
    .filter((entry) => entry.table === table)
    .map((entry) => entry.row as Record<string, unknown>);
}

function pipelineRunRows() {
  return insertedRowsFor(pipelineRuns);
}

function budgetEventRows() {
  return insertedRowsFor(analysisModelBudgetEvents);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('analyzeMeal traceContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetL4DecompositionCacheForTests();
    mockRecordPromptVersion.mockResolvedValue('pv-test-id');
    mockMatchIngredients.mockResolvedValue({ matched: [], unmatched: [] });
    mockAssembleResult.mockReturnValue({
      result: { mealItems: [] },
      metrics: { cookedToRawFactorFires: 0 },
    });
    mockValidateNutritionOutput.mockReturnValue([]);
    mockDetectAnomalies.mockReturnValue([]);
    mockDbValues.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it('records decomposition language metadata and language retry count', async () => {
    const db = makeDb();
    const promptVersionsUsed = new Map<string, string>();
    const traceContext: AnalyzeMealTraceContext = {
      requestId: 'req-language-metadata',
      db,
      userId: 'user-test-1',
      promptVersionsUsed,
    };
    const generateStructuredOutputStream = vi
      .fn()
      .mockResolvedValueOnce(VALID_DECOMP)
      .mockResolvedValueOnce({
        isFood: true,
        mealItems: [
          {
            name: 'rice',
            ingredients: [
              {
                name: 'rice',
                estimatedGrams: 200,
                cookingMethod: null,
                userFacingUnit: null,
              },
            ],
          },
        ],
        mealSlot: null,
      })
      .mockResolvedValueOnce({
        mealItems: [
          {
            mealItemName: 'Rice',
            ingredients: [
              {
                ingredientName: 'Rice',
                caloriesKcal: { low: 250, mid: 300, high: 360 },
                proteinG: { low: 5, mid: 6, high: 8 },
                carbohydrateG: { low: 50, mid: 65, high: 80 },
                fatG: { low: 0.3, mid: 0.5, high: 1 },
              },
            ],
          },
        ],
      });
    const gemini = createMockGemini({ generateStructuredOutputStream });

    await analyzeMeal(
      'rice',
      { ...USER_CONTEXT, inputLanguage: 'en', outputLanguage: 'en' },
      db,
      gemini,
      undefined,
      traceContext
    );

    const decompositionStageArg = mockLogStage.mock.calls.find(
      ([arg]) => arg.stage === 'decomposition'
    )?.[0];
    expect(decompositionStageArg?.outputJson).toEqual(
      expect.objectContaining({
        languageMetadata: {
          inputLanguage: 'en',
          outputLanguage: 'en',
          guardReason: 'matches_output_language',
          guardSeverity: 'info',
          guardPassed: true,
          retryCount: 1,
        },
      })
    );
    expect(pipelineRunRows()[0].retryCount).toBe(1);
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

  it('records always-on model token budget events when trace logging is disabled', async () => {
    vi.stubEnv('PIPELINE_TRACE_ENABLED', 'false');
    const db = makeDb();
    const generateStructuredOutputStream = vi
      .fn()
      .mockImplementationOnce((_params, opts) => {
        opts?.onAttemptComplete?.({
          attempt: 1,
          model: 'decomposition-model',
          inputTokens: 10,
          outputTokens: 20,
          error: null,
        });
        return Promise.resolve(VALID_DECOMP);
      })
      .mockImplementationOnce((_params, opts) => {
        opts?.onAttemptComplete?.({
          attempt: 1,
          model: 'nutrition-model',
          inputTokens: 30,
          outputTokens: 40,
          error: null,
        });
        return Promise.resolve(VALID_NUTRITION);
      });
    const gemini = createMockGemini({ generateStructuredOutputStream });

    await analyzeMeal('cơm trắng', USER_CONTEXT, db, gemini, undefined);

    expect(mockLogStage).not.toHaveBeenCalled();
    expect(mockRecordPromptVersion).not.toHaveBeenCalled();
    expect(pipelineRunRows()).toHaveLength(0);
    expect(budgetEventRows()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workKind: 'primary',
          requestCount: 1,
          inputTokens: 0,
          outputTokens: 0,
          errorCategory: null,
        }),
        expect.objectContaining({
          workKind: 'primary',
          requestCount: 0,
          model: 'decomposition-model',
          inputTokens: 10,
          outputTokens: 20,
          errorCategory: null,
        }),
        expect.objectContaining({
          workKind: 'primary',
          requestCount: 0,
          model: 'nutrition-model',
          inputTokens: 30,
          outputTokens: 40,
          errorCategory: null,
        }),
      ])
    );
  });

  it('records provider-pressure errors from recovered model attempts without trace logging', async () => {
    vi.stubEnv('PIPELINE_TRACE_ENABLED', 'false');
    const db = makeDb();
    const recoveredError = new Error('UNAVAILABLE: backend overloaded');
    const generateStructuredOutputStream = vi
      .fn()
      .mockImplementationOnce((_params, opts) => {
        opts?.onAttemptComplete?.({
          attempt: 1,
          model: 'decomposition-model',
          inputTokens: null,
          outputTokens: null,
          error: recoveredError,
        });
        opts?.onAttemptComplete?.({
          attempt: 2,
          model: 'decomposition-model',
          inputTokens: 11,
          outputTokens: 22,
          error: null,
        });
        return Promise.resolve(VALID_DECOMP);
      })
      .mockResolvedValueOnce(VALID_NUTRITION);
    const gemini = createMockGemini({ generateStructuredOutputStream });

    const result = await analyzeMeal(
      'cơm trắng',
      USER_CONTEXT,
      db,
      gemini,
      undefined
    );

    expect(result.success).toBe(true);
    expect(mockLogStage).not.toHaveBeenCalled();
    expect(mockRecordPromptVersion).not.toHaveBeenCalled();
    expect(budgetEventRows()).toContainEqual(
      expect.objectContaining({
        workKind: 'primary',
        requestCount: 0,
        model: 'decomposition-model',
        inputTokens: 0,
        outputTokens: 0,
        errorCategory: 'server_error',
      })
    );
  });

  it('classifies 504 model attempt failures as timeout budget events', async () => {
    vi.stubEnv('PIPELINE_TRACE_ENABLED', 'false');
    const db = makeDb();
    const timeoutError = Object.assign(new Error('Gateway Timeout'), {
      status: 504,
    });
    const generateStructuredOutputStream = vi
      .fn()
      .mockImplementationOnce((_params, opts) => {
        opts?.onAttemptComplete?.({
          attempt: 1,
          model: 'decomposition-model',
          inputTokens: null,
          outputTokens: null,
          error: timeoutError,
        });
        return Promise.resolve(VALID_DECOMP);
      })
      .mockResolvedValueOnce(VALID_NUTRITION);
    const gemini = createMockGemini({ generateStructuredOutputStream });

    const result = await analyzeMeal(
      'cơm trắng',
      USER_CONTEXT,
      db,
      gemini,
      undefined
    );

    expect(result.success).toBe(true);
    expect(budgetEventRows()).toContainEqual(
      expect.objectContaining({
        workKind: 'primary',
        requestCount: 0,
        model: 'decomposition-model',
        inputTokens: 0,
        outputTokens: 0,
        errorCategory: 'timeout',
      })
    );
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

    const rows = pipelineRunRows();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.densityEnvelopeFires).toBe(1);
    expect(row.macroInconsistentFires).toBe(2);
    expect(row.anomalyTypes).toContain('density_envelope');
    expect(row.anomalyTypes).toContain('macro_inconsistent');
  });

  it('forwards assembly cookedToRawFactorFires into pipeline_runs counters', async () => {
    const db = makeDb();
    const promptVersionsUsed = new Map<string, string>();
    const traceContext: AnalyzeMealTraceContext = {
      requestId: 'req-cooked-factors',
      db,
      userId: 'user-test-1',
      promptVersionsUsed,
    };
    mockAssembleResult.mockReturnValueOnce({
      result: { mealItems: [] },
      metrics: { cookedToRawFactorFires: 2 },
    });

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

    const rows = pipelineRunRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].cookedToRawFactorFires).toBe(2);
  });

  it('records unknown cooking-method state derivations in pipeline_runs counters', async () => {
    const db = makeDb();
    const promptVersionsUsed = new Map<string, string>();
    const traceContext: AnalyzeMealTraceContext = {
      requestId: 'req-state-unknown',
      db,
      userId: 'user-test-1',
      promptVersionsUsed,
    };

    const gemini = createMockGemini({
      generateStructuredOutputStream: vi
        .fn()
        .mockResolvedValueOnce({
          isFood: true,
          mealItems: [
            {
              mealItemId: 'meal-1',
              name: 'salad lạ',
              cookingMethod: 'trộn mơ hồ',
              ingredients: [
                {
                  ingredientId: 'ingredient-1',
                  rawName: 'rau',
                  canonicalName: 'rau',
                  grams: 100,
                },
              ],
            },
          ],
          mealSlot: null,
        })
        .mockResolvedValueOnce({
          mealItems: [
            {
              mealItemName: 'Salad lạ',
              ingredients: [
                {
                  ingredientName: 'Rau',
                  caloriesKcal: { low: 10, mid: 15, high: 20 },
                  proteinG: { low: 1, mid: 2, high: 3 },
                  carbohydrateG: { low: 2, mid: 3, high: 4 },
                  fatG: { low: 0, mid: 0.2, high: 0.5 },
                },
              ],
            },
          ],
        }),
    });

    await analyzeMeal(
      'salad lạ',
      USER_CONTEXT,
      db,
      gemini,
      undefined,
      traceContext
    );

    const rows = pipelineRunRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].dbStateUnknownFires).toBe(1);
  });

  it('records canonicalName vocabulary misses in preMatchAliasHits', async () => {
    const db = {
      ...makeDb(),
      execute: vi
        .fn()
        .mockResolvedValue([
          { name_primary: 'Gạo tẻ', name_en: null, name_alt: null },
        ]),
    } as unknown as AppDb;
    const promptVersionsUsed = new Map<string, string>();
    const traceContext: AnalyzeMealTraceContext = {
      requestId: 'req-canonical-miss',
      db,
      userId: 'user-test-1',
      promptVersionsUsed,
    };

    const gemini = createMockGemini({
      generateStructuredOutputStream: vi
        .fn()
        .mockResolvedValueOnce({
          isFood: true,
          mealItems: [
            {
              mealItemId: 'meal-1',
              name: 'cơm',
              cookingMethod: 'nấu',
              ingredients: [
                {
                  ingredientId: 'ingredient-1',
                  rawName: 'gạo',
                  canonicalName: 'Gạo lứt lạ',
                  grams: 100,
                },
              ],
            },
          ],
          mealSlot: null,
        })
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

    const rows = pipelineRunRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].preMatchAliasHits).toBe(1);
  });

  it('aggregates ambiguityFlags into pipeline_runs telemetry', async () => {
    const db = makeDb();
    const promptVersionsUsed = new Map<string, string>();
    const traceContext: AnalyzeMealTraceContext = {
      requestId: 'req-ambiguity',
      db,
      userId: 'user-test-1',
      promptVersionsUsed,
    };

    const gemini = createMockGemini({
      generateStructuredOutputStream: vi
        .fn()
        .mockResolvedValueOnce({
          isFood: true,
          mealItems: [
            {
              mealItemId: 'meal-1',
              name: 'bún trộn',
              cookingMethod: 'trộn',
              ingredients: [
                {
                  ingredientId: 'ingredient-1',
                  rawName: 'bún',
                  canonicalName: 'Bún tươi',
                  grams: 100,
                  ambiguityFlags: [
                    'multiple_dish_interpretations',
                    'cross_cuisine_ingredient',
                  ],
                },
                {
                  ingredientId: 'ingredient-2',
                  rawName: 'rau thơm',
                  canonicalName: 'Rau thơm',
                  grams: 20,
                  ambiguityFlags: ['cross_cuisine_ingredient'],
                },
              ],
            },
          ],
          mealSlot: null,
        })
        .mockResolvedValueOnce({
          mealItems: [
            {
              mealItemName: 'Bún trộn',
              ingredients: [
                {
                  ingredientName: 'Bún',
                  caloriesKcal: { low: 100, mid: 120, high: 140 },
                  proteinG: { low: 1, mid: 2, high: 3 },
                  carbohydrateG: { low: 20, mid: 25, high: 30 },
                  fatG: { low: 0, mid: 0.2, high: 0.5 },
                },
                {
                  ingredientName: 'Rau thơm',
                  caloriesKcal: { low: 1, mid: 2, high: 3 },
                  proteinG: { low: 0, mid: 0.2, high: 0.5 },
                  carbohydrateG: { low: 0, mid: 0.5, high: 1 },
                  fatG: { low: 0, mid: 0, high: 0.1 },
                },
              ],
            },
          ],
        }),
    });

    const result = await analyzeMeal(
      'bún trộn',
      USER_CONTEXT,
      db,
      gemini,
      undefined,
      traceContext
    );

    expect(result.__telemetry?.ambiguityFlagCounts).toEqual({
      multiple_dish_interpretations: 1,
      cross_cuisine_ingredient: 2,
    });
    const rows = pipelineRunRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].ambiguityFlagCounts).toEqual({
      multiple_dish_interpretations: 1,
      cross_cuisine_ingredient: 2,
    });
  });

  it('persists RRF Phase A aggregate metrics when matching records measurements', async () => {
    const db = makeDb();
    const promptVersionsUsed = new Map<string, string>();
    const traceContext: AnalyzeMealTraceContext = {
      requestId: 'req-rrf',
      db,
      userId: 'user-test-1',
      promptVersionsUsed,
    };
    mockMatchIngredients.mockImplementationOnce(
      async (
        _ingredients: unknown,
        _mealContext: unknown,
        _db: unknown,
        _gemini: unknown,
        opts: {
          measurementContext?: {
            rrfMeasurements?: {
              topVectorEqualsTopFuzzy: boolean;
              latencyMs: number;
            }[];
          };
        }
      ) => {
        opts.measurementContext?.rrfMeasurements?.push(
          { topVectorEqualsTopFuzzy: true, latencyMs: 4.4 },
          { topVectorEqualsTopFuzzy: false, latencyMs: 12.7 }
        );
        return { matched: [], unmatched: [] };
      }
    );

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

    const rows = pipelineRunRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rrfSampled: true,
      rrfDisagreementCount: 1,
      rrfIngredientsObserved: 2,
      rrfMeasurementLatencyMs: 13,
    });
  });

  it('does not retry Call 2 for density_envelope warnings', async () => {
    const db = makeDb();
    const promptVersionsUsed = new Map<string, string>();
    const traceContext: AnalyzeMealTraceContext = {
      requestId: 'req-density-retry',
      db,
      userId: 'user-test-1',
      promptVersionsUsed,
    };
    mockValidateNutritionOutput
      .mockReturnValueOnce([
        {
          type: 'density_envelope',
          message: 'density breach',
          severity: 'warning',
        },
      ])
      .mockReturnValue([]);

    const generateStructuredOutputStream = vi
      .fn()
      .mockResolvedValueOnce(VALID_DECOMP)
      .mockResolvedValueOnce(VALID_NUTRITION)
      .mockResolvedValueOnce(VALID_NUTRITION);
    const gemini = createMockGemini({ generateStructuredOutputStream });

    const result = await analyzeMeal(
      'cơm trắng',
      USER_CONTEXT,
      db,
      gemini,
      undefined,
      traceContext
    );

    expect(result.success).toBe(true);
    expect(generateStructuredOutputStream).toHaveBeenCalledTimes(2);
  });

  it('records cacheHitL4=true when decomposition comes from cache', async () => {
    const db = makeDb();
    const promptVersionsUsed = new Map<string, string>();
    const traceContext: AnalyzeMealTraceContext = {
      requestId: 'req-cache-1',
      db,
      userId: 'user-test-1',
      promptVersionsUsed,
    };
    const secondTraceContext: AnalyzeMealTraceContext = {
      requestId: 'req-cache-2',
      db,
      userId: 'user-test-1',
      promptVersionsUsed: new Map(),
    };
    const generateStructuredOutputStream = vi
      .fn()
      .mockResolvedValueOnce(VALID_DECOMP)
      .mockResolvedValueOnce(VALID_NUTRITION)
      .mockResolvedValueOnce(VALID_NUTRITION);
    const gemini = createMockGemini({ generateStructuredOutputStream });

    await analyzeMeal(
      'cơm trắng',
      USER_CONTEXT,
      db,
      gemini,
      undefined,
      traceContext,
      { l4Cache: { enabled: true } }
    );
    await analyzeMeal(
      '  Cơm   Trắng ',
      USER_CONTEXT,
      db,
      gemini,
      undefined,
      secondTraceContext,
      { l4Cache: { enabled: true } }
    );

    const rows = pipelineRunRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].cacheHitL4).toBe(false);
    expect(rows[1].cacheHitL4).toBe(true);
    expect(generateStructuredOutputStream).toHaveBeenCalledTimes(3);
  });

  it('skips Call 1 retry on language mismatch when PIPELINE_LANGUAGE_GUARD_RETRY_ENABLED=false', async () => {
    vi.stubEnv('PIPELINE_LANGUAGE_GUARD_RETRY_ENABLED', 'false');
    const db = makeDb();
    const promptVersionsUsed = new Map<string, string>();
    const traceContext: AnalyzeMealTraceContext = {
      requestId: 'req-lang-no-retry',
      db,
      userId: 'user-test-1',
      promptVersionsUsed,
    };
    // First call returns Vietnamese-named items even though context expects English.
    // Without the flag this would trigger a second decomposition call; with it off
    // the orchestrator must accept the bad-language output and proceed.
    const generateStructuredOutputStream = vi
      .fn()
      .mockResolvedValueOnce(VALID_DECOMP)
      .mockResolvedValueOnce(VALID_NUTRITION);
    const gemini = createMockGemini({ generateStructuredOutputStream });

    await analyzeMeal(
      'rice',
      { ...USER_CONTEXT, inputLanguage: 'en', outputLanguage: 'en' },
      db,
      gemini,
      undefined,
      traceContext
    );

    expect(generateStructuredOutputStream).toHaveBeenCalledTimes(2);
    const decompositionStageArg = mockLogStage.mock.calls.find(
      ([arg]) => arg.stage === 'decomposition'
    )?.[0];
    expect(
      (
        decompositionStageArg?.outputJson as {
          languageMetadata: { retryCount: number };
        }
      ).languageMetadata.retryCount
    ).toBe(0);
    expect(pipelineRunRows()[0].retryCount).toBe(0);
  });

  it('silences model budget event writes when ANALYSIS_BUDGET_EVENTS_ENABLED=false', async () => {
    vi.stubEnv('ANALYSIS_BUDGET_EVENTS_ENABLED', 'false');
    const db = makeDb();
    const generateStructuredOutputStream = vi
      .fn()
      .mockImplementationOnce((_params, opts) => {
        opts?.onAttemptComplete?.({
          attempt: 1,
          model: 'decomposition-model',
          inputTokens: 10,
          outputTokens: 20,
          error: null,
        });
        return Promise.resolve(VALID_DECOMP);
      })
      .mockImplementationOnce((_params, opts) => {
        opts?.onAttemptComplete?.({
          attempt: 1,
          model: 'nutrition-model',
          inputTokens: 30,
          outputTokens: 40,
          error: null,
        });
        return Promise.resolve(VALID_NUTRITION);
      });
    const gemini = createMockGemini({ generateStructuredOutputStream });

    await analyzeMeal('cơm trắng', USER_CONTEXT, db, gemini, undefined);

    expect(budgetEventRows()).toHaveLength(0);
  });
});

describe('analyzeMeal trace cross-table consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetL4DecompositionCacheForTests();
    mockRecordPromptVersion.mockResolvedValue('pv-test-id');
    mockMatchIngredients.mockResolvedValue({ matched: [], unmatched: [] });
    mockAssembleResult.mockReturnValue({
      result: { mealItems: [] },
      metrics: { cookedToRawFactorFires: 0 },
    });
    mockValidateNutritionOutput.mockReturnValue([]);
    mockDetectAnomalies.mockReturnValue([]);
    mockDbValues.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('binds pipeline_runs, stage logs, and budget events to one requestId', async () => {
    const db = makeDb();
    const promptVersionsUsed = new Map<string, string>();
    const requestId = 'req-trace-consistency';
    const traceContext: AnalyzeMealTraceContext = {
      requestId,
      db,
      userId: 'user-trace-consistency',
      promptVersionsUsed,
    };
    const generateStructuredOutputStream = vi
      .fn()
      .mockImplementationOnce((_params, opts) => {
        opts?.onAttemptComplete?.({
          attempt: 1,
          model: 'decomposition-model',
          inputTokens: 11,
          outputTokens: 22,
          error: null,
        });
        return Promise.resolve(VALID_DECOMP);
      })
      .mockImplementationOnce((_params, opts) => {
        opts?.onAttemptComplete?.({
          attempt: 1,
          model: 'nutrition-model',
          inputTokens: 33,
          outputTokens: 44,
          error: null,
        });
        return Promise.resolve(VALID_NUTRITION);
      });
    const gemini = createMockGemini({ generateStructuredOutputStream });

    await analyzeMeal(
      'cơm trắng',
      USER_CONTEXT,
      db,
      gemini,
      undefined,
      traceContext
    );

    const runs = pipelineRunRows();
    expect(runs).toHaveLength(1);
    expect(runs[0].requestId).toBe(requestId);

    // Each logStage call must reference the same requestId, and stage indices
    // must form the canonical 1..4 sequence (decomposition → assembly).
    const stageCalls = mockLogStage.mock.calls.map(([arg]) => arg);
    expect(stageCalls).toHaveLength(4);
    expect(stageCalls.map((arg) => arg.requestId)).toEqual([
      requestId,
      requestId,
      requestId,
      requestId,
    ]);
    expect(stageCalls.map((arg) => arg.stageIndex)).toEqual([1, 2, 3, 4]);
    expect(stageCalls.every((arg) => arg.status === 'success')).toBe(true);

    // Each stageLogId must be unique — distinct rows for distinct stages.
    const stageLogIds = stageCalls.map((arg) => arg.stageLogId);
    expect(new Set(stageLogIds).size).toBe(4);

    // Budget events: one start for the request + one per LLM attempt.
    // Production currently emits start + 2 attempts = 3 rows.
    const budgetRows = budgetEventRows();
    expect(budgetRows.length).toBeGreaterThanOrEqual(3);
    for (const row of budgetRows) {
      expect(row.requestId).toBe(requestId);
      expect(row.route).toBe('/api/analyze-meal');
      expect(row.workKind).toBe('primary');
      expect(row.provider).toBe('gemini');
    }

    // Total request duration must envelope each stage duration — telemetry
    // rows would be incoherent if a stage logged a duration that exceeded
    // the run's total elapsed time.
    const totalMs = runs[0].totalMs as number;
    for (const stage of stageCalls) {
      expect(stage.durationMs).toBeLessThanOrEqual(totalMs + 1);
    }
  });

  it('records non-null token counts on attempt budget events', async () => {
    const db = makeDb();
    const traceContext: AnalyzeMealTraceContext = {
      requestId: 'req-trace-tokens',
      db,
      userId: 'user-trace-tokens',
      promptVersionsUsed: new Map(),
    };
    const generateStructuredOutputStream = vi
      .fn()
      .mockImplementationOnce((_params, opts) => {
        opts?.onAttemptComplete?.({
          attempt: 1,
          model: 'decomposition-model',
          inputTokens: 100,
          outputTokens: 200,
          error: null,
        });
        return Promise.resolve(VALID_DECOMP);
      })
      .mockImplementationOnce((_params, opts) => {
        opts?.onAttemptComplete?.({
          attempt: 1,
          model: 'nutrition-model',
          inputTokens: 300,
          outputTokens: 400,
          error: null,
        });
        return Promise.resolve(VALID_NUTRITION);
      });
    const gemini = createMockGemini({ generateStructuredOutputStream });

    await analyzeMeal(
      'cơm trắng',
      USER_CONTEXT,
      db,
      gemini,
      undefined,
      traceContext
    );

    // Attempt rows are recorded per LLM call (requestCount=0). The start
    // event uses requestCount=1 and lacks per-attempt token counts.
    const attemptRows = budgetEventRows().filter(
      (row) => row.requestCount === 0
    );
    expect(attemptRows).toHaveLength(2);
    const totalsByModel = new Map(
      attemptRows.map((row) => [
        row.model as string,
        {
          inputTokens: row.inputTokens as number,
          outputTokens: row.outputTokens as number,
        },
      ])
    );
    expect(totalsByModel.get('decomposition-model')).toEqual({
      inputTokens: 100,
      outputTokens: 200,
    });
    expect(totalsByModel.get('nutrition-model')).toEqual({
      inputTokens: 300,
      outputTokens: 400,
    });
  });
});

describe('shadow-runner integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetL4DecompositionCacheForTests();
    mockRecordPromptVersion.mockResolvedValue('pv-test-id');
    mockMatchIngredients.mockResolvedValue({ matched: [], unmatched: [] });
    mockAssembleResult.mockReturnValue({
      result: FULL_PIPELINE_RESULT,
      metrics: { cookedToRawFactorFires: 0 },
    });
    mockValidateNutritionOutput.mockReturnValue([]);
    mockDetectAnomalies.mockReturnValue([]);
    mockDbValues.mockResolvedValue(undefined);
  });

  function makeTrace(db: AppDb): AnalyzeMealTraceContext {
    return {
      requestId: 'shadow-request-id',
      db,
      userId: 'user-test-1',
      promptVersionsUsed: new Map(),
    };
  }

  function makeGemini() {
    return createMockGemini({
      generateStructuredOutputStream: vi
        .fn()
        .mockResolvedValueOnce(VALID_DECOMP)
        .mockResolvedValueOnce(VALID_NUTRITION)
        .mockResolvedValueOnce(VALID_DECOMP)
        .mockResolvedValueOnce(VALID_NUTRITION),
    });
  }

  it('does not invoke the shadow runner when disabled', async () => {
    const db = makeDb();
    const persistShadowRun = vi.fn().mockResolvedValue(undefined);

    await analyzeMeal(
      'cơm trắng',
      USER_CONTEXT,
      db,
      makeGemini(),
      undefined,
      makeTrace(db),
      { shadow: { enabled: false, persistShadowRun } }
    );
    await Promise.resolve();

    expect(persistShadowRun).not.toHaveBeenCalled();
  });

  it('invokes shadow after the primary response when sampled in', async () => {
    const db = makeDb();
    let primaryReturned = false;
    const persistShadowRun = vi.fn().mockImplementation(async () => {
      expect(primaryReturned).toBe(true);
    });
    const guard = {
      shouldRun: vi.fn().mockResolvedValue({ run: true }),
      onPrimaryComplete: vi.fn(),
    };

    const response = await analyzeMeal(
      'cơm trắng',
      USER_CONTEXT,
      db,
      makeGemini(),
      undefined,
      makeTrace(db),
      { shadow: { enabled: true, rate: 1, persistShadowRun, guard } }
    );
    primaryReturned = true;

    expect(response.success).toBe(true);
    await vi.waitFor(() => expect(persistShadowRun).toHaveBeenCalledOnce());
    expect(mockMatchIngredients.mock.calls[1]?.[4]).toMatchObject({
      concurrency: 1,
    });
  });

  it('shadow failure does not perturb the primary response', async () => {
    const db = makeDb();
    const persistShadowRun = vi.fn().mockRejectedValue(new Error('db down'));
    const guard = {
      shouldRun: vi.fn().mockResolvedValue({ run: true }),
      onPrimaryComplete: vi.fn(),
    };

    const response = await analyzeMeal(
      'cơm trắng',
      USER_CONTEXT,
      db,
      makeGemini(),
      undefined,
      makeTrace(db),
      { shadow: { enabled: true, rate: 1, persistShadowRun, guard } }
    );

    expect(response.success).toBe(true);
  });

  it('aborts when the guard says no and persists the reason', async () => {
    const db = makeDb();
    const persistShadowRun = vi.fn().mockResolvedValue(undefined);
    const guard = {
      shouldRun: vi
        .fn()
        .mockResolvedValue({ run: false, reason: 'aborted_primary_p95' }),
      onPrimaryComplete: vi.fn(),
    };

    await analyzeMeal(
      'cơm trắng',
      USER_CONTEXT,
      db,
      makeGemini(),
      undefined,
      makeTrace(db),
      { shadow: { enabled: true, rate: 1, persistShadowRun, guard } }
    );

    await vi.waitFor(() => expect(persistShadowRun).toHaveBeenCalledOnce());
    expect(persistShadowRun.mock.calls[0][0].outcome).toBe(
      'aborted_primary_p95'
    );
  });
});
