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
  const names = (left: ReturnType<typeof omittedMealItems>) =>
    left.flatMap((o) => o.item.ingredients.map((i) => i.ingredient.rawName));

  it('finds a whole dish Call 2 left out', () => {
    expect(
      names(
        omittedMealItems([rice, noodles], estimation(answer('Cơm', ['Cơm'])))
      )
    ).toEqual(['Mì', 'Gia vị']);
  });

  it('finds the ingredients skipped inside an answered dish', () => {
    expect(
      names(omittedMealItems([noodles], estimation(answer('Indomie', ['Mì']))))
    ).toEqual(['Gia vị']);
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

  it('asks for the food that is missing, not the renamed one', () => {
    expect(
      names(
        omittedMealItems(
          [dish('Cơm trứng', ['Jasmine rice', 'Egg', 'Oil'])],
          estimation(answer('Cơm trứng', ['Jasmine rice, cooked', 'Egg']))
        )
      )
    ).toEqual(['Oil']);
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
    expect(
      vi.mocked(estimate).mock.calls[0][0].mealItems.map((m) => m.mealItem.name)
    ).toEqual(['Indomie']);
  });

  it('sends each answer to the same-name dish it was asked for', async () => {
    const bowl = dish('Cơm', ['Cơm', 'Trứng']);
    const estimate = vi.fn(async () => ({
      estimation: estimation(
        answer('Cơm', ['Trứng']),
        answer('Cơm', ['Trứng'])
      ),
    })) as unknown as GroundedEstimator['estimate'];
    const out = await fillOmitted(
      estimation(answer('Cơm', ['Cơm']), answer('Cơm', ['Cơm'])),
      args(estimate, [bowl, bowl])
    );
    expect(
      out.mealItems.map((m) => m.ingredients.map((i) => i.ingredientName))
    ).toEqual([
      ['Cơm', 'Trứng'],
      ['Cơm', 'Trứng'],
    ]);
  });

  it('keeps a split answer on the same-name dish that asked', async () => {
    const plate = dish('Cơm', ['Cơm', 'Trứng', 'Dầu']);
    const estimate = vi.fn(async () => ({
      estimation: estimation(
        answer('Cơm', ['Trứng']),
        answer('Cơm', ['Dầu ô liu'])
      ),
    })) as unknown as GroundedEstimator['estimate'];
    const out = await fillOmitted(
      estimation(
        answer('Cơm', ['Cơm']),
        answer('Cơm', ['Cơm', 'Trứng', 'Dầu'])
      ),
      args(estimate, [plate, plate])
    );
    expect(
      out.mealItems.map((m) => m.ingredients.map((i) => i.ingredientName))
    ).toEqual([
      ['Cơm', 'Trứng', 'Dầu ô liu'],
      ['Cơm', 'Trứng', 'Dầu'],
    ]);
  });

  it('never lets a renamed answer take a food asked for by name', async () => {
    const first = dish('Cơm', ['Rice', 'Oil']);
    const second = dish('Cơm', ['Rice']);
    const estimate = vi.fn(async () => ({
      estimation: {
        mealItems: [
          {
            mealItemName: 'Cơm',
            ingredients: [
              { ingredientName: 'Oil, olive', grossG: 10 },
              { ingredientName: 'Rice', grossG: 200 },
            ],
          },
          {
            mealItemName: 'Cơm',
            ingredients: [{ ingredientName: 'Rice', grossG: 100 }],
          },
        ],
      },
    })) as unknown as GroundedEstimator['estimate'];
    const out = await fillOmitted(
      estimation(),
      args(estimate, [first, second])
    );
    expect(
      out.mealItems.map((m) => m.ingredients.map((i) => i.grossG))
    ).toEqual([[200, 10], [100]]);
  });

  it('reaches the second same-name dish when only it is short', async () => {
    const bowl = dish('Cơm', ['Cơm', 'Trứng']);
    const estimate = vi.fn(async () => ({
      estimation: estimation(answer('Cơm', ['Trứng'])),
    })) as unknown as GroundedEstimator['estimate'];
    const out = await fillOmitted(
      estimation(answer('Cơm', ['Cơm', 'Trứng']), answer('Cơm', ['Cơm'])),
      args(estimate, [bowl, bowl])
    );
    expect(out.mealItems[1].ingredients.map((i) => i.ingredientName)).toEqual([
      'Cơm',
      'Trứng',
    ]);
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
