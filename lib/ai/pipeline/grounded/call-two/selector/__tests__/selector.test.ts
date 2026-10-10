import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type {
  GroundedEstimation,
  GroundedIngredientEstimate,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type {
  MatchCandidate,
  MealItemWithCandidates,
} from '@/lib/ai/prompts/build/grounded-candidates';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import {
  applySelection,
  CALL_TWO_CANDIDATES,
  callTwoView,
  startCandidateSelector,
} from '../selector';

const candidate = (
  n: number,
  dbState: MatchCandidate['dbState'] = 'cooked'
): MatchCandidate => ({
  id: `c${n}`,
  similarity: 0.9,
  dbName: `Row ${n}`,
  dbNameEn: `Row ${n} (en)`,
  dbState,
  source: 'usda',
  per100gKcal: 100,
  per100gProteinG: 10,
  per100gCarbohydrateG: 10,
  per100gFatG: 1,
  inediblePct: 0,
});

/** One dish per entry: [dish name, [ingredient name, candidates][]]. */
function meal(dishes: [string, [string, MatchCandidate[]][]][]): {
  decomposition: MealDecompositionV2;
  mealItems: MealItemWithCandidates[];
} {
  const decomposition: MealDecompositionV2 = {
    isFood: true,
    mealSlot: 'lunch',
    mealItems: dishes.map(([name, ings]) => ({
      name,
      cookingMethod: 'nấu',
      ingredients: ings.map(([raw]) => ({ rawName: raw, canonicalName: raw })),
    })),
  };
  const mealItems = decomposition.mealItems.map((mealItem, d) => ({
    mealItem,
    ingredients: mealItem.ingredients.map((ingredient, i) => ({
      ingredient,
      candidates: dishes[d][1][i][1],
    })),
  }));
  return { decomposition, mealItems };
}

const estimate = (
  ingredientName: string,
  selectedCandidateId: string
): GroundedIngredientEstimate => ({
  ingredientName,
  selectedCandidateId,
  ...(selectedCandidateId === 'none' ? { rejectReason: 'no match' } : {}),
  grossG: 100,
  refusePct: 0,
  proteinG: { low: 1, mid: 2, high: 3 },
  carbohydrateG: { low: 1, mid: 2, high: 3 },
  fatG: { low: 1, mid: 2, high: 3 },
});

function selectorLlm(
  answer: (userMessage: string) => Promise<{ ranking: string[] }>
): GeminiClient {
  return {
    generateStructuredOutput: vi.fn(async (p: { userMessage: string }) =>
      answer(p.userMessage)
    ),
  } as unknown as GeminiClient;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('callTwoView', () => {
  it('shows Call 2 only the first candidates and leaves the pool whole', () => {
    const pool = Array.from({ length: 16 }, (_, i) => candidate(i + 1));
    const { mealItems } = meal([['Cơm', [['cơm', pool]]]]);
    const view = callTwoView(mealItems);
    expect(view[0].ingredients[0].candidates.map((c) => c.id)).toEqual(
      pool.slice(0, CALL_TWO_CANDIDATES).map((c) => c.id)
    );
    expect(mealItems[0].ingredients[0].candidates).toHaveLength(16);
  });
});

describe('startCandidateSelector', () => {
  it('asks once per ingredient with a choice and keeps the best real candidate', async () => {
    const { mealItems } = meal([
      [
        'Cơm gà',
        [
          ['cơm', [candidate(1), candidate(2)]],
          ['gà', [candidate(1)]], // one candidate: nothing to choose
          ['dưa', [candidate(1), candidate(2)]],
        ],
      ],
    ]);
    const llm = selectorLlm(async (msg) =>
      msg.includes('<ingredient>cơm')
        ? { ranking: ['none', 'c2', 'c1'] }
        : { ranking: ['none'] }
    );
    const picks = await startCandidateSelector({
      gemini: llm,
      model: 'm',
      mealText: 'cơm gà',
      mealItems,
    }).settle();

    expect(llm.generateStructuredOutput).toHaveBeenCalledTimes(2);
    expect([...picks]).toEqual([[0, 'c2']]);
  });

  it('ignores a failed call', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { mealItems } = meal([
      [
        'Cơm',
        [
          ['cơm', [candidate(1), candidate(2)]],
          ['canh', [candidate(1), candidate(2)]],
        ],
      ],
    ]);
    const llm = selectorLlm(async (msg) => {
      if (msg.includes('<ingredient>canh')) throw new Error('overloaded');
      return { ranking: ['c2'] };
    });
    const picks = await startCandidateSelector({
      gemini: llm,
      model: 'm',
      mealText: 'cơm, canh',
      mealItems,
    }).settle();
    expect([...picks]).toEqual([[0, 'c2']]);
  });

  it('stops waiting a few seconds after Call 2 and aborts the open calls', async () => {
    vi.useFakeTimers();
    const { mealItems } = meal([
      ['Cơm', [['cơm', [candidate(1), candidate(2)]]]],
    ]);
    let signal: AbortSignal | undefined;
    const llm = {
      generateStructuredOutput: vi.fn(
        (p: { abortSignal?: AbortSignal }) =>
          new Promise(() => {
            signal = p.abortSignal;
          })
      ),
    } as unknown as GeminiClient;
    const settled = startCandidateSelector({
      gemini: llm,
      model: 'm',
      mealText: 'cơm',
      mealItems,
    }).settle();
    await vi.advanceTimersByTimeAsync(3_000);

    expect((await settled).size).toBe(0);
    expect(signal?.aborted).toBe(true);
  });
});

describe('applySelection', () => {
  const pool = [candidate(1), candidate(2), candidate(3, 'raw')];

  it('overrides Call 2 when the rows share a state, or when Call 2 picked none', () => {
    const { decomposition, mealItems } = meal([
      [
        'Cơm',
        [
          ['cơm', pool],
          ['canh', pool],
          ['rau', pool],
        ],
      ],
    ]);
    const grounded: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'Cơm',
          ingredients: [
            estimate('cơm', 'c1'),
            estimate('canh', 'none'),
            estimate('rau', 'c1'),
          ],
        },
      ],
    };
    const out = applySelection({
      decomposition,
      grounded,
      mealItems,
      // cơm: same state (cooked → cooked); canh: Call 2 said none;
      // rau: cooked → raw would change the grams basis, so it is kept.
      picks: new Map([
        [0, 'c2'],
        [1, 'c2'],
        [2, 'c3'],
      ]),
    });

    const ids = out.grounded.mealItems[0].ingredients.map(
      (g) => g.selectedCandidateId
    );
    expect(ids).toEqual(['c2', 'c2', 'c1']);
    expect(out.overrides).toBe(2);
    expect(
      out.grounded.mealItems[0].ingredients[1].rejectReason
    ).toBeUndefined();
    // The input estimation is untouched.
    expect(grounded.mealItems[0].ingredients[0].selectedCandidateId).toBe('c1');
  });

  it('pairs a dish Call 2 split into same-name items the way resolution does', () => {
    const { decomposition, mealItems } = meal([
      [
        'Bún chả',
        [
          ['bún', pool],
          ['chả', pool],
        ],
      ],
    ]);
    const grounded: GroundedEstimation = {
      mealItems: [
        { mealItemName: 'Bún chả', ingredients: [estimate('bún', 'c1')] },
        { mealItemName: 'Bún chả', ingredients: [estimate('chả', 'c1')] },
      ],
    };
    const out = applySelection({
      decomposition,
      grounded,
      mealItems,
      picks: new Map([[1, 'c2']]),
    });
    expect(
      out.grounded.mealItems.map((m) => m.ingredients[0].selectedCandidateId)
    ).toEqual(['c1', 'c2']);
  });
});
