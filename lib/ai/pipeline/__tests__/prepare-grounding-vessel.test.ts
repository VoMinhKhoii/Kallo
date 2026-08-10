import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserContext } from '../../types';

const { mockMatchTopK } = vi.hoisted(() => ({
  mockMatchTopK: vi.fn(),
}));

vi.mock('../../matching/top-k-cascade', () => ({
  matchTopKPerIngredient: mockMatchTopK,
}));

vi.mock('../../portion/ingredient-portion', () => ({
  resolvePortionsForCallTwo: vi.fn((ingredients: unknown[]) => ({
    resolutions: ingredients.map(() => ({
      grams: null,
      provenance: 'llm_range',
      confidence: 'none',
      note: 'test',
    })),
    anchors: ingredients.map(() => null),
  })),
}));

import { MATCHING_TIMEOUT_MS } from '../config/stage-timeouts';
import { prepareGrounding } from '../prepare-grounding';
import type { MealDecompositionV2 } from '../schemas-v2';

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

beforeEach(() => {
  mockMatchTopK.mockImplementation(async (ingredients: unknown[]) =>
    ingredients.map((_, ingredientIndex) => ({
      ingredientIndex,
      candidates: [],
    }))
  );
});

afterEach(() => {
  delete process.env.PORTION_VESSEL_ENABLED;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('prepareGrounding vessel envelopes', () => {
  it('threads enabled envelopes index-aligned into the preparation and payload', async () => {
    const decomposition: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'phở',
          cookingMethod: 'ninh',
          vesselToken: 'tô',
          vesselSize: 'medium',
          ingredients: [{ rawName: 'bánh phở', canonicalName: 'Bánh phở' }],
        },
        {
          name: 'gà luộc',
          cookingMethod: 'luộc',
          ingredients: [{ rawName: 'gà', canonicalName: 'Gà' }],
        },
      ],
    };

    const prepared = await prepareGrounding({
      decomposition,
      userContext,
      db: {} as never,
      gemini: {} as never,
      traceContext: undefined,
      emit: vi.fn(),
      topK: 3,
      matchConcurrency: 2,
      vesselEnabled: true,
    });

    expect(prepared.vesselEnvelopes[0]).toMatchObject({
      token: 'tô',
      vesselMl: 700,
      dishClass: 'soup',
    });
    expect(prepared.vesselEnvelopes[1]).toBeNull();
    expect(
      prepared.mealItemsWithCandidates.map((item) => item.vesselEnvelope)
    ).toEqual(prepared.vesselEnvelopes);
  });

  it('returns only null envelopes when the flag is off', async () => {
    const decomposition: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'phở',
          cookingMethod: 'ninh',
          vesselToken: 'tô',
          ingredients: [{ rawName: 'bánh phở', canonicalName: 'Bánh phở' }],
        },
      ],
    };

    const prepared = await prepareGrounding({
      decomposition,
      userContext,
      db: {} as never,
      gemini: {} as never,
      traceContext: undefined,
      emit: vi.fn(),
      topK: 3,
      matchConcurrency: 2,
      vesselEnabled: false,
    });

    expect(prepared.vesselEnvelopes).toEqual([null]);
    expect(prepared.mealItemsWithCandidates[0].vesselEnvelope).toBeNull();
  });
});

describe('prepareGrounding matching deadline', () => {
  it('rejects a matching operation that never settles', async () => {
    vi.useFakeTimers();
    mockMatchTopK.mockReturnValue(new Promise(() => {}));
    const decomposition: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'salmon salad',
          cookingMethod: 'pan-seared',
          ingredients: [{ rawName: 'salmon', canonicalName: 'Salmon' }],
        },
      ],
    };

    const pending = prepareGrounding({
      decomposition,
      userContext,
      db: {} as never,
      gemini: {} as never,
      traceContext: undefined,
      emit: vi.fn(),
      topK: 3,
      matchConcurrency: 2,
      vesselEnabled: false,
    });
    const assertion = expect(pending).rejects.toMatchObject({
      code: 'PIPELINE_TIMEOUT',
      retryable: true,
    });

    await vi.advanceTimersByTimeAsync(MATCHING_TIMEOUT_MS);
    await assertion;
  });
});
