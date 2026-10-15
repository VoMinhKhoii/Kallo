import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloudTrace } from '@/lib/ai/pipeline/telemetry/cloud-trace/cloud-trace';
import {
  type BoundedNutrition,
  NUTRITION_KEYS,
  type NutritionValues,
} from '@/lib/ai/types/nutrition-values';
import type { PipelineResult } from '@/lib/ai/types/result';
import type { AppDb } from '@/lib/infra/db/client';

vi.mock('@/lib/infra/db/schema', () => ({
  pipelineRequests: { id: 'id' },
}));

// Helper to build a db mock that captures the last SET payload
function makeMockDb() {
  let capturedSet: Record<string, unknown> | null = null;

  const catchFn = vi.fn().mockReturnValue(undefined);
  const where = vi.fn().mockReturnValue({ catch: catchFn });
  const set = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
    capturedSet = payload;
    return { where };
  });
  const update = vi.fn().mockReturnValue({ set });

  return {
    db: { update } as unknown as AppDb,
    getCapturedSet: () => capturedSet,
    set,
    catchFn,
  };
}

// Import after mocks
const { logPipelineEnd } = await import('@/lib/ai/pipeline/telemetry/logging');
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('logPipelineEnd', () => {
  it('writes summary facts once with terminal status and emits bounded final macros/items', () => {
    const { db, getCapturedSet, set } = makeMockDb();
    const emit = vi.spyOn(cloudTrace, 'finish');
    const nutrition = Object.fromEntries(
      NUTRITION_KEYS.map((key) => [key, 10])
    ) as unknown as NutritionValues;
    const bounded = Object.fromEntries(
      NUTRITION_KEYS.map((key) => [key, { low: 8, mid: 10, high: 12 }])
    ) as unknown as BoundedNutrition;
    const result: PipelineResult = {
      mealItems: [
        {
          name: 'Synthetic meal'.repeat(20),
          ingredients: [],
          boundedNutrition: bounded,
          displayedNutrition: nutrition,
        },
      ],
      mealSlot: null,
      confidenceOverall: 'high',
      boundedNutrition: bounded,
      displayedNutrition: nutrition,
      unmatchedIngredients: [],
    };
    vi.stubEnv('TRACE_LOG_ENABLED', 'false');
    cloudTrace.start('summary', {
      rawInput: 'Synthetic input',
      profile: 'haiku',
    });
    cloudTrace.emit('summary', 'llm', { model: 'claude-haiku-5-5' });
    cloudTrace.emit('summary', 'llm', { model: 'gemini-3.1-flash-lite' });
    logPipelineEnd('summary', 'success', 123, db, undefined, null, { result });
    expect(set).toHaveBeenCalledTimes(1);
    expect(getCapturedSet()).toMatchObject({
      status: 'success',
      durationMs: 123,
      mealName: result.mealItems[0].name.slice(0, 160),
      modelProfile: 'haiku',
      models: ['claude-haiku-5-5', 'gemini-3.1-flash-lite'],
      caloriesKcal: 10,
      proteinG: 10,
      carbohydrateG: 10,
      fatG: 10,
      itemCount: 1,
      traceLogged: false,
      errorCode: null,
    });
    expect(emit).toHaveBeenCalledWith(
      'summary',
      expect.objectContaining({
        summary: expect.objectContaining({
          kcal: { low: 8, mid: 10, high: 12 },
          items: [
            expect.objectContaining({
              grams: 0,
              kcal: { low: 8, mid: 10, high: 12 },
            }),
          ],
        }),
      })
    );
  });

  it('keeps raw preview and error code on failure, and isolates synchronous database errors', () => {
    const { db, getCapturedSet } = makeMockDb();
    vi.stubEnv('TRACE_LOG_ENABLED', 'false');
    cloudTrace.start('error-summary', {
      rawInput: 'Synthetic preview',
      profile: 'stable',
    });
    logPipelineEnd('error-summary', 'error', 1, db, 'failure', null, {
      errorCode: 'parse_error',
    });
    expect(getCapturedSet()).toMatchObject({
      mealName: 'Synthetic preview',
      errorCode: 'parse_error',
      caloriesKcal: null,
      itemCount: null,
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      logPipelineEnd('missing', 'error', 1, {
        update() {
          throw new Error('db unavailable');
        },
      } as unknown as AppDb)
    ).not.toThrow();
  });
  it('includes promptVersionsUsed in SET when provided with data', () => {
    const { db, getCapturedSet } = makeMockDb();

    logPipelineEnd('req-1', 'success', 100, db, undefined, {
      decomposition: 'v-abc123',
      nutrition: 'v-def456',
    });

    const payload = getCapturedSet();
    expect(payload).not.toBeNull();
    expect(payload?.promptVersionsUsed).toEqual({
      decomposition: 'v-abc123',
      nutrition: 'v-def456',
    });
  });

  it('leaves promptVersionsUsed null when not provided', () => {
    const { db, getCapturedSet } = makeMockDb();

    logPipelineEnd('req-1', 'error', 50, db, 'boom');

    const payload = getCapturedSet();
    expect(payload).not.toBeNull();
    expect(payload?.promptVersionsUsed).toBeUndefined();
  });

  it('leaves promptVersionsUsed null when passed null', () => {
    const { db, getCapturedSet } = makeMockDb();

    logPipelineEnd('req-1', 'success', 200, db, undefined, null);

    const payload = getCapturedSet();
    expect(payload).not.toBeNull();
    expect(payload?.promptVersionsUsed).toBeUndefined();
  });

  it('is a no-op when requestId is null', () => {
    const { db, set } = makeMockDb();

    logPipelineEnd(null, 'success', 100, db);

    expect(set).not.toHaveBeenCalled();
  });
});
