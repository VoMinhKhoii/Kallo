import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/lib/db';

// ---------------------------------------------------------------------------
// Hoisted mocks — only mock the heavy I/O surfaces (matching, assembly,
// validation, trace). Leave streaming/parsers and ids real so SSE id
// threading is exercised end-to-end.
// ---------------------------------------------------------------------------
const { mockMatchIngredients, mockAssembleResult } = vi.hoisted(() => ({
  mockMatchIngredients: vi.fn(),
  mockAssembleResult: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/ai/pipeline/trace', () => ({
  logStage: vi.fn(),
  logLlmCall: vi.fn(),
  recordPromptVersion: vi.fn().mockResolvedValue(undefined),
  buildLlmStageTrace: vi.fn().mockResolvedValue(undefined),
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
  validateDecompositionOutput: vi.fn().mockReturnValue([]),
  validateNutritionOutput: vi.fn().mockReturnValue([]),
  detectAnomalies: vi.fn().mockReturnValue([]),
  classifyAnomalies: vi.fn().mockReturnValue('pass'),
  THRESHOLDS: { MIN_TOTAL_KCAL: 1 },
}));

vi.mock('@/lib/ai/prompts', () => ({
  buildDecompositionPrompt: vi.fn().mockReturnValue('decomp-system-prompt'),
  buildNutritionPrompt: vi.fn().mockReturnValue('nutrition-system-prompt'),
}));

import type { GeminiClient } from '@/lib/ai/gemini';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { UserContext } from '@/lib/ai/types';
// Imported after mocks
import { analyzeMeal } from '../orchestrator';

const COMPACT_MEAL_ID_RE = /^m[1-9]\d*$/;

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

function makeDecompJson(names: string[]) {
  return JSON.stringify({
    isFood: true,
    mealItems: names.map((name) => ({
      name,
      ingredients: [
        {
          name: `${name}-ing`,
          estimatedGrams: 100,
          cookingMethod: null,
          userFacingUnit: null,
        },
      ],
    })),
    mealSlot: null,
  });
}

function makeNutritionJson(names: string[]) {
  return JSON.stringify({
    mealItems: names.map((name) => ({
      mealItemName: name.charAt(0).toUpperCase() + name.slice(1),
      ingredients: [
        {
          ingredientName: `${name.charAt(0).toUpperCase()}${name.slice(1)}-ing`,
          caloriesKcal: { low: 100, mid: 110, high: 120 },
          proteinG: { low: 1, mid: 2, high: 3 },
          carbohydrateG: { low: 20, mid: 22, high: 24 },
          fatG: { low: 0.5, mid: 1, high: 1.5 },
        },
      ],
    })),
  });
}

/**
 * Build a Gemini mock whose stream methods invoke `onChunk` with the FULL
 * accumulated JSON in a single chunk (sufficient for the regex-based
 * occurrence parser) and resolve to the parsed object.
 */
function makeStreamingGemini(
  decompNames: string[],
  nutritionNames: string[]
): GeminiClient {
  const decompJson = makeDecompJson(decompNames);
  const decompParsed = JSON.parse(decompJson);
  const nutritionJson = makeNutritionJson(nutritionNames);
  const nutritionParsed = JSON.parse(nutritionJson);

  const stream = vi
    .fn()
    .mockImplementationOnce(
      async (_args: unknown, opts?: { onChunk?: (acc: string) => void }) => {
        opts?.onChunk?.(decompJson);
        return decompParsed;
      }
    )
    .mockImplementationOnce(
      async (_args: unknown, opts?: { onChunk?: (acc: string) => void }) => {
        opts?.onChunk?.(nutritionJson);
        return nutritionParsed;
      }
    );

  return {
    generateStructuredOutput: vi.fn(),
    generateStructuredOutputStream: stream,
    generateEmbedding: vi.fn().mockResolvedValue(Array(768).fill(0.1)),
    generateEmbeddingBatch: vi
      .fn()
      .mockImplementation((texts: string[]) =>
        Promise.resolve(texts.map(() => Array(768).fill(0.1)))
      ),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('analyzeMeal SSE id threading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchIngredients.mockResolvedValue({ matched: [], unmatched: [] });
    mockAssembleResult.mockReturnValue({
      result: { mealItems: [] },
      metrics: { cookedToRawFactorFires: 0 },
    });
  });

  it('emits a compact mealItemId on every item_name event', async () => {
    const events: StreamEvent[] = [];
    const result = await analyzeMeal(
      'cơm trắng',
      USER_CONTEXT,
      {} as AppDb,
      makeStreamingGemini(['cơm trắng'], ['cơm trắng']),
      (e) => events.push(e)
    );

    expect(result.success).toBe(true);
    const nameEvents = events.filter((e) => e.type === 'item_name');
    expect(nameEvents.length).toBeGreaterThan(0);
    for (const e of nameEvents) {
      // Narrow for TS
      if (e.type !== 'item_name') continue;
      expect(e.mealItemId).toMatch(COMPACT_MEAL_ID_RE);
    }
  });

  it('emits a compact mealItemId on every item_macros event', async () => {
    const events: StreamEvent[] = [];
    await analyzeMeal(
      'cơm trắng',
      USER_CONTEXT,
      {} as AppDb,
      makeStreamingGemini(['cơm trắng'], ['cơm trắng']),
      (e) => events.push(e)
    );

    const macroEvents = events.filter((e) => e.type === 'item_macros');
    expect(macroEvents.length).toBeGreaterThan(0);
    for (const e of macroEvents) {
      if (e.type !== 'item_macros') continue;
      expect(e.mealItemId).toMatch(COMPACT_MEAL_ID_RE);
    }
  });

  it('every item_macros mealItemId was previously announced via item_name (macroIds ⊆ nameIds)', async () => {
    const events: StreamEvent[] = [];
    await analyzeMeal(
      'cơm trắng và canh chua',
      USER_CONTEXT,
      {} as AppDb,
      makeStreamingGemini(
        ['cơm trắng', 'canh chua'],
        ['cơm trắng', 'canh chua']
      ),
      (e) => events.push(e)
    );

    const nameIds = new Set<string>();
    const macroIds: string[] = [];
    for (const e of events) {
      if (e.type === 'item_name') nameIds.add(e.mealItemId);
      if (e.type === 'item_macros') macroIds.push(e.mealItemId);
    }
    expect(macroIds.length).toBeGreaterThan(0);
    for (const id of macroIds) {
      expect(nameIds.has(id)).toBe(true);
    }
  });

  it('mints distinct mealItemIds for duplicate display names (two cơm trắng)', async () => {
    const events: StreamEvent[] = [];
    await analyzeMeal(
      '2 chén cơm trắng',
      USER_CONTEXT,
      {} as AppDb,
      makeStreamingGemini(
        ['cơm trắng', 'cơm trắng'],
        ['cơm trắng', 'cơm trắng']
      ),
      (e) => events.push(e)
    );

    const names = events.filter(
      (e): e is Extract<StreamEvent, { type: 'item_name' }> =>
        e.type === 'item_name'
    );
    expect(names.length).toBe(2);
    expect(names[0].mealItemId).not.toBe(names[1].mealItemId);
    expect(names[0].mealItemId).toMatch(COMPACT_MEAL_ID_RE);
    expect(names[1].mealItemId).toMatch(COMPACT_MEAL_ID_RE);

    const macros = events.filter(
      (e): e is Extract<StreamEvent, { type: 'item_macros' }> =>
        e.type === 'item_macros'
    );
    expect(macros.length).toBe(2);
    expect(macros[0].mealItemId).not.toBe(macros[1].mealItemId);
    // Each macro id corresponds to a previously announced name id, in order.
    expect(new Set(macros.map((m) => m.mealItemId))).toEqual(
      new Set(names.map((n) => n.mealItemId))
    );
  });

  it('reuses mealItemIds when decomposition streaming retries', async () => {
    const decompJson = makeDecompJson(['cơm trắng']);
    const decompParsed = JSON.parse(decompJson);
    const nutritionJson = makeNutritionJson(['cơm trắng']);
    const nutritionParsed = JSON.parse(nutritionJson);
    const stream = vi
      .fn()
      .mockImplementationOnce(
        async (
          _args: unknown,
          opts?: {
            onAttemptStart?: (attempt: number) => void;
            onChunk?: (acc: string) => void;
          }
        ) => {
          opts?.onAttemptStart?.(1);
          opts?.onChunk?.(decompJson);
          opts?.onAttemptStart?.(2);
          opts?.onChunk?.(decompJson);
          return decompParsed;
        }
      )
      .mockImplementationOnce(
        async (_args: unknown, opts?: { onChunk?: (acc: string) => void }) => {
          opts?.onChunk?.(nutritionJson);
          return nutritionParsed;
        }
      );
    const events: StreamEvent[] = [];

    await analyzeMeal(
      'cơm trắng',
      USER_CONTEXT,
      {} as AppDb,
      {
        generateStructuredOutput: vi.fn(),
        generateStructuredOutputStream: stream,
        generateEmbedding: vi.fn().mockResolvedValue(Array(768).fill(0.1)),
        generateEmbeddingBatch: vi.fn().mockResolvedValue([]),
      },
      (e) => events.push(e)
    );

    const names = events.filter(
      (e): e is Extract<StreamEvent, { type: 'item_name' }> =>
        e.type === 'item_name'
    );
    expect(names).toHaveLength(2);
    expect(names[0].mealItemId).toBe(names[1].mealItemId);
  });
});
