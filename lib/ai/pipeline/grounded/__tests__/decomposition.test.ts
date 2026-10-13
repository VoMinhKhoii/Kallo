import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelProfile } from '@/lib/ai/pipeline/config/model-profile';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { UserContext } from '@/lib/ai/types/user-context';
import type { AppDb } from '@/lib/infra/db/client';

const { closeMock } = vi.hoisted(() => ({ closeMock: vi.fn() }));
vi.mock('@/lib/ai/matching/streamed-matching', () => ({
  createStreamedMatching: () => ({
    onChunk: () => {},
    match: async () => [],
    close: closeMock,
  }),
}));
vi.mock('@/lib/ai/matching/match-ingredients', () => ({
  createMatchingPrewarm: () => () => {},
}));

import {
  pinOnePartDishWeights,
  runGroundedDecomposition,
} from '../decomposition';

function run(stream: GeminiClient['generateStructuredOutputStream']) {
  return runGroundedDecomposition({
    rawInput: 'phở bò',
    userContext: { outputLanguage: 'vi', inputLanguage: 'vi' } as UserContext,
    db: {} as AppDb,
    gemini: { generateStructuredOutputStream: stream } as GeminiClient,
    traceContext: undefined,
    emit: () => {},
    promptCtx: {} as PromptPersonalizationContext,
    profile: { decompositionModel: 'm' } as ModelProfile,
  });
}

describe('runGroundedDecomposition and streamed matching', () => {
  beforeEach(() => closeMock.mockReset());

  it('closes streamed matching when Call 1 fails', async () => {
    await expect(
      run(async () => {
        throw new Error('provider down');
      })
    ).rejects.toThrow('provider down');
    expect(closeMock).toHaveBeenCalled();
  });

  it('closes streamed matching when the input is not food', async () => {
    const out = await run(
      async () =>
        ({ plan: '', isFood: false, mealSlot: 'snack', mealItems: [] }) as never
    );
    expect(out).toEqual({ nonFood: true });
    expect(closeMock).toHaveBeenCalled();
  });
});

describe('pinOnePartDishWeights', () => {
  const dish = (servedMassG: number | undefined, names: string[]) => ({
    name: names.join(' '),
    cookingMethod: 'raw',
    servedMassG,
    ingredients: names.map((n) => ({ rawName: n, canonicalName: n })),
  });
  const meal = (...mealItems: ReturnType<typeof dish>[]) => ({
    isFood: true,
    mealSlot: 'snack' as const,
    mealItems,
  });

  it("moves a one-part dish's typed weight onto its food", () => {
    const m = meal(dish(100, ['almonds']));
    pinOnePartDishWeights(m);
    expect(m.mealItems[0].ingredients[0]).toMatchObject({
      explicitMass: { grams: 100, basis: 'unknown' },
    });
    expect(m.mealItems[0].servedMassG).toBeUndefined();
  });

  it("keeps a food's own typed weight, and leaves several-part dishes to scaling", () => {
    const own = dish(100, ['almonds']);
    Object.assign(own.ingredients[0], {
      explicitMass: { grams: 80, basis: 'edible' },
    });
    const m = meal(own, dish(300, ['rice', 'egg']), dish(undefined, ['pear']));
    pinOnePartDishWeights(m);
    expect(m.mealItems[0].ingredients[0]).toMatchObject({
      explicitMass: { grams: 80 },
    });
    expect(m.mealItems[1].servedMassG).toBe(300);
    expect(m.mealItems[1].ingredients[0]).not.toHaveProperty('explicitMass');
    expect(m.mealItems[2].ingredients[0]).not.toHaveProperty('explicitMass');
  });
});
