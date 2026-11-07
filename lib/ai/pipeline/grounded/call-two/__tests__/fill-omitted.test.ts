import { describe, expect, it, vi } from 'vitest';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { GroundedEstimator } from '@/lib/ai/pipeline/estimator/types';
import {
  type FillOmittedArgs,
  fillOmitted,
  omittedMealItems,
} from '@/lib/ai/pipeline/grounded/call-two/fill-omitted';
import type { MealItemWithCandidates } from '@/lib/ai/prompts/build/grounded-candidates';

const dish = (name: string, parts: string[]) =>
  ({
    mealItem: { name },
    ingredients: parts.map((rawName) => ({
      ingredient: { rawName },
      candidates: [],
    })),
  }) as unknown as MealItemWithCandidates;

const answer = (name: string, parts: string[]) => ({
  mealItemName: name,
  ingredients: parts.map((ingredientName) => ({ ingredientName, grossG: 100 })),
});
const estimation = (...items: ReturnType<typeof answer>[]) =>
  ({ mealItems: items }) as unknown as GroundedEstimation;

function args(
  estimate: GroundedEstimator['estimate'],
  mealItems: MealItemWithCandidates[],
  extra: Partial<FillOmittedArgs> = {}
): FillOmittedArgs {
  return {
    estimator: { estimate } as GroundedEstimator,
    mealItems,
    originalPrompt: 'meal',
    promptCtx: {} as FillOmittedArgs['promptCtx'],
    temperature: 0.4,
    budgetMs: 20_000,
    ...extra,
  };
}

describe('omittedMealItems', () => {
  const noodles = dish('Indomie', ['Mì', 'Gia vị']);
  const rice = dish('Cơm', ['Cơm']);

  it('finds a whole dish Call 2 left out', () => {
    expect(
      omittedMealItems([rice, noodles], estimation(answer('Cơm', ['Cơm'])))
    ).toEqual([noodles]);
  });

  it('finds the ingredients skipped inside an answered dish', () => {
    const left = omittedMealItems(
      [noodles],
      estimation(answer('Indomie', ['Mì']))
    );
    expect(left.map((m) => m.ingredients.length)).toEqual([1]);
    expect(left[0].ingredients[0].ingredient.rawName).toBe('Gia vị');
  });

  it('does not ask again for a dish Call 2 renamed', () => {
    expect(
      omittedMealItems(
        [noodles],
        estimation(answer('Mì gói Indomie', ['Mì', 'Gia vị']))
      )
    ).toEqual([]);
  });

  it('does not ask again for an ingredient renamed inside its dish', () => {
    expect(
      omittedMealItems(
        [noodles],
        estimation(answer('Indomie', ['Mì ăn liền', 'Gia vị']))
      )
    ).toEqual([]);
  });
});

describe('fillOmitted', () => {
  const noodles = dish('Indomie', ['Mì']);
  const rice = dish('Cơm', ['Cơm']);
  const partial = estimation(answer('Cơm', ['Cơm']));

  it('adds the re-asked dish, and asks only for that dish', async () => {
    const estimate = vi.fn(async () => ({
      estimation: estimation(answer('Indomie', ['Mì'])),
    })) as unknown as GroundedEstimator['estimate'];
    const out = await fillOmitted(partial, args(estimate, [rice, noodles]));
    expect(out.mealItems.map((m) => m.mealItemName)).toEqual([
      'Cơm',
      'Indomie',
    ]);
    expect(vi.mocked(estimate).mock.calls[0][0].mealItems).toEqual([noodles]);
  });

  it('makes no call when nothing is missing', async () => {
    const estimate = vi.fn() as unknown as GroundedEstimator['estimate'];
    const whole = estimation(answer('Cơm', ['Cơm']));
    expect(await fillOmitted(whole, args(estimate, [rice]))).toBe(whole);
    expect(estimate).not.toHaveBeenCalled();
  });

  it('keeps the first answer when the re-ask fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const estimate = vi.fn(async () => {
      throw new Error('overloaded');
    }) as unknown as GroundedEstimator['estimate'];
    expect(await fillOmitted(partial, args(estimate, [rice, noodles]))).toBe(
      partial
    );
  });

  it('does not start with too little of the run left', async () => {
    const estimate = vi.fn() as unknown as GroundedEstimator['estimate'];
    await fillOmitted(
      partial,
      args(estimate, [rice, noodles], { budgetMs: 1 })
    );
    expect(estimate).not.toHaveBeenCalled();
  });

  it('leaves dishes a failed chunk already degraded', async () => {
    const estimate = vi.fn() as unknown as GroundedEstimator['estimate'];
    await fillOmitted(
      partial,
      args(estimate, [rice, noodles], { skipMealItemNames: ['Indomie'] })
    );
    expect(estimate).not.toHaveBeenCalled();
  });

  it('meters the re-ask like any other Call 2 attempt', async () => {
    const onAttemptComplete = vi.fn();
    const estimate = vi.fn(async () => ({
      estimation: estimation(answer('Indomie', ['Mì'])),
    })) as unknown as GroundedEstimator['estimate'];
    await fillOmitted(
      partial,
      args(estimate, [rice, noodles], { onAttemptComplete })
    );
    expect(vi.mocked(estimate).mock.calls[0][2]).toEqual({ onAttemptComplete });
  });
});
