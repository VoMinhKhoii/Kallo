import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IngredientV2MatchResult } from '@/lib/ai/matching/candidate';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type {
  GroundedEstimation,
  GroundedIngredientEstimate,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { PortionResolution } from '@/lib/ai/portion/types';
import { type RescuePart, rescueMealText, startDishRescue } from '../rescue';

const triple = { low: 1, mid: 2, high: 3 };
const estimate = (
  ingredientName: string,
  selectedCandidateId?: string
): GroundedIngredientEstimate => ({
  ingredientName,
  ...(selectedCandidateId ? { selectedCandidateId } : {}),
  grossG: 100,
  refusePct: 0,
  proteinG: triple,
  carbohydrateG: triple,
  fatG: triple,
});
const match = (i: number, n: number) =>
  ({
    ingredientIndex: i,
    candidates: Array.from({ length: n }, () => ({})),
  }) as unknown as IngredientV2MatchResult;
const defer: PortionResolution = {
  grams: null,
  massBasis: null,
  provenance: 'llm_range',
  confidence: 'none',
  note: '',
};
const dish = (name: string, ings: string[]) => ({
  name,
  cookingMethod: 'nấu',
  ingredients: ings.map((rawName) => ({ rawName, canonicalName: rawName })),
});

// flan: no candidate. cơm: dish named after itself, with candidates.
// nước: plain water, never rescued.
const decomposition: MealDecompositionV2 = {
  isFood: true,
  mealSlot: 'lunch',
  mealItems: [
    dish('Bánh flan', ['bánh flan']),
    dish('Cơm', ['cơm']),
    dish('Nước', ['nước']),
  ],
};
const state = {
  decomposition,
  matchResults: [match(0, 0), match(1, 3), match(2, 0)],
  portionResolutions: [defer, defer, defer],
};
const parts: RescuePart[] = [
  {
    ingredient: { rawName: 'trứng', canonicalName: 'Trứng' },
    match: match(0, 2),
    estimate: estimate('trứng', 'c1'),
  },
];
const call2 = (cơm: string | undefined): GroundedEstimation => ({
  mealItems: [
    { mealItemName: 'Bánh flan', ingredients: [estimate('bánh flan')] },
    { mealItemName: 'Cơm', ingredients: [estimate('cơm', cơm)] },
    { mealItemName: 'Nước', ingredients: [estimate('nước')] },
  ],
});

afterEach(() => vi.useRealTimers());

describe('startDishRescue', () => {
  it('starts only the certain mini-meals before Call 2 answers', () => {
    const runSubMeal = vi.fn(async () => parts);
    const rescue = startDishRescue({
      state,
      language: 'vi',
      runStartedAt: Date.now(),
      runSubMeal,
    });

    expect(rescue.started()).toEqual([0]);
    expect(runSubMeal).toHaveBeenCalledWith('1 phần bánh flan');
  });

  it('rescues what Call 2 rejected and leaves what it accepted', async () => {
    const runSubMeal = vi.fn(async () => parts);
    const rescue = startDishRescue({
      state,
      language: 'vi',
      runStartedAt: Date.now(),
      runSubMeal,
    });
    const out = await rescue.apply(call2('c1'));

    expect(out?.rescued).toBe(1);
    expect(runSubMeal).toHaveBeenCalledTimes(1);
    expect(
      out?.state.decomposition.mealItems.map((m) => m.ingredients[0].rawName)
    ).toEqual(['trứng', 'cơm', 'nước']);
  });

  it('starts a mini-meal after Call 2 for a dish it rejected', async () => {
    const runSubMeal = vi.fn(async () => parts);
    const rescue = startDishRescue({
      state,
      language: 'en',
      runStartedAt: Date.now(),
      runSubMeal,
    });
    const out = await rescue.apply(call2('none'));

    expect(runSubMeal).toHaveBeenCalledWith('1 portion of cơm');
    expect(out?.rescued).toBe(2);
  });

  it('treats a pick outside the candidate list as a rejection', async () => {
    const runSubMeal = vi.fn(async () => parts);
    const rescue = startDishRescue({
      state,
      language: 'vi',
      runStartedAt: Date.now(),
      runSubMeal,
    });
    const out = await rescue.apply(call2('c9')); // cơm has 3 candidates
    expect(runSubMeal).toHaveBeenCalledWith('1 phần cơm');
    expect(out?.rescued).toBe(2);
  });

  it('stops waiting for a slow mini-meal and keeps the main answer', async () => {
    vi.useFakeTimers();
    const rescue = startDishRescue({
      state,
      language: 'vi',
      runStartedAt: Date.now(),
      runSubMeal: () => new Promise(() => {}),
    });
    const out = rescue.apply(call2('c1'));
    await vi.advanceTimersByTimeAsync(12_000);
    expect(await out).toBeNull();
  });
});

describe('startDishRescue deadline', () => {
  it('waits only as long as the run budget allows', async () => {
    vi.useFakeTimers();
    const rescue = startDishRescue({
      state,
      language: 'vi',
      runStartedAt: Date.now() - 30_000, // 5 s of the 35 s budget left
      runSubMeal: () => new Promise(() => {}),
    });
    let settled = false;
    void rescue.apply(call2('c1')).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(settled).toBe(true);
  });
});

describe('startDishRescue past the deadline', () => {
  it('starts no new mini-meal once the run budget is spent', async () => {
    const runSubMeal = vi.fn(async () => parts);
    const rescue = startDishRescue({
      state,
      language: 'vi',
      runStartedAt: Date.now() - 36_000,
      runSubMeal,
    });
    runSubMeal.mockClear(); // the certain (no-candidate) one started at once
    await rescue.apply(call2('none'));
    expect(runSubMeal).not.toHaveBeenCalled();
  });
});

describe('startDishRescue cleanup', () => {
  it('starts no queued mini-meal once apply has returned', async () => {
    vi.useFakeTimers();
    const four: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: ['a', 'b', 'c', 'd'].map((n) => dish(n, [n])),
    };
    const finish: Array<() => void> = [];
    const runSubMeal = vi.fn(
      () =>
        new Promise<RescuePart[] | null>((resolve) => {
          finish.push(() => resolve(null));
        })
    );
    const rescue = startDishRescue({
      state: {
        decomposition: four,
        matchResults: [0, 1, 2, 3].map((i) => match(i, 0)),
        portionResolutions: [defer, defer, defer, defer],
      },
      language: 'en',
      runStartedAt: Date.now(),
      runSubMeal,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(runSubMeal).toHaveBeenCalledTimes(3); // the fourth waits its turn
    const out = rescue.apply({
      mealItems: ['a', 'b', 'c', 'd'].map((n) => ({
        mealItemName: n,
        ingredients: [estimate(n)],
      })),
    });
    await vi.advanceTimersByTimeAsync(12_000);
    expect(await out).toBeNull();
    // A running mini-meal finishing after that frees a slot, but the queued
    // one must not start.
    finish[0]();
    await vi.advanceTimersByTimeAsync(0);
    expect(runSubMeal).toHaveBeenCalledTimes(3);
  });
});

describe('rescueMealText', () => {
  it('adds the canonical name only when it says more', () => {
    expect(
      rescueMealText({ rawName: 'bánh flan', canonicalName: 'Bánh flan' }, 'vi')
    ).toBe('1 phần bánh flan');
    expect(
      rescueMealText(
        { rawName: 'flan', canonicalName: 'Caramel custard' },
        'en'
      )
    ).toBe('1 portion of flan (Caramel custard)');
  });
});
