import { afterEach, describe, expect, it, vi } from 'vitest';
import { STABLE_PROFILE } from '@/lib/ai/pipeline/config/model-profile';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type {
  GroundedEstimator,
  GroundedEstimatorInput,
} from '@/lib/ai/pipeline/estimator/types';
import type {
  MatchCandidate,
  MealItemWithCandidates,
} from '@/lib/ai/prompts/build/grounded-candidates';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { UserContext } from '@/lib/ai/types/user-context';
import { runCallTwoStage } from '../call-two';

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
    brothConsumption: 'some',
  },
};

const pool: MatchCandidate[] = Array.from({ length: 8 }, (_, i) => ({
  id: `c${i + 1}`,
  similarity: 0.9,
  dbName: `Row ${i + 1}`,
  dbState: 'cooked',
  source: 'usda',
  per100gKcal: 100,
  per100gProteinG: 10,
  per100gCarbohydrateG: 10,
  per100gFatG: 1,
  inediblePct: 0,
}));

const decomposition: MealDecompositionV2 = {
  isFood: true,
  mealSlot: 'lunch',
  mealItems: [
    {
      name: 'Cơm',
      cookingMethod: 'nấu',
      ingredients: [{ rawName: 'cơm', canonicalName: 'Cơm' }],
    },
  ],
};
const mealItems: MealItemWithCandidates[] = [
  {
    mealItem: decomposition.mealItems[0],
    ingredients: [
      {
        ingredient: decomposition.mealItems[0].ingredients[0],
        candidates: pool,
      },
    ],
  },
];
const call2Answer: GroundedEstimation = {
  mealItems: [
    {
      mealItemName: 'Cơm',
      ingredients: [
        {
          ingredientName: 'cơm',
          selectedCandidateId: 'c1',
          grossG: 200,
          refusePct: 0,
          proteinG: { low: 4, mid: 5, high: 6 },
          carbohydrateG: { low: 50, mid: 56, high: 60 },
          fatG: { low: 0, mid: 1, high: 2 },
        },
      ],
    },
  ],
};

function stage(selectorRanking: string[]) {
  let seen: GroundedEstimatorInput | undefined;
  const estimator: GroundedEstimator = {
    id: 'fake',
    model: 'fake',
    estimate: vi.fn(async (input) => {
      seen = input;
      return { estimation: call2Answer };
    }),
  };
  const gemini = {
    generateStructuredOutput: vi.fn(async () => ({ ranking: selectorRanking })),
  } as unknown as GeminiClient;
  const run = runCallTwoStage({
    traceContext: undefined,
    emit: () => {},
    gemini,
    profile: STABLE_PROFILE,
    estimatorOverride: estimator,
    decomposition,
    matchResults: [{ ingredientIndex: 0, candidates: [] }],
    mealItemsWithCandidates: mealItems,
    streamedMealItemIds: new Map(),
    rawInput: '1 chén cơm',
    promptCtx: userContext,
    temperature: 0.4,
    userContext,
    onAttemptComplete: () => {},
    onChunkTick: () => {},
  });
  return { run, gemini, seen: () => seen };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('runCallTwoStage with the candidate selector', () => {
  it('lets the selector rank the candidates Call 2 saw and takes its pick', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { run, seen } = stage(['c6', 'c2']);
    const result = await run;

    expect(seen()?.mealItems[0].ingredients[0].candidates).toHaveLength(8);
    expect(
      result.grounded.mealItems[0].ingredients[0].selectedCandidateId
    ).toBe('c6');
    // Streamed events used Call 2's pick; the final flush re-sends.
    expect(result.itemMacrosStreamed.size).toBe(0);
  });

  it('keeps Call 2 alone when the selector is switched off', async () => {
    vi.stubEnv('CANDIDATE_SELECTOR_ENABLED', 'false');
    const { run, gemini } = stage(['c6']);
    const result = await run;

    expect(gemini.generateStructuredOutput).not.toHaveBeenCalled();
    expect(
      result.grounded.mealItems[0].ingredients[0].selectedCandidateId
    ).toBe('c1');
  });
});
