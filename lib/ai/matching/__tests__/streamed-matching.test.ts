import { describe, expect, it, vi } from 'vitest';
import type { IngredientV2MatchResult } from '@/lib/ai/matching/candidate';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { AppDb } from '@/lib/infra/db/client';

const { cardsMock, matchMock } = vi.hoisted(() => ({
  cardsMock: vi.fn(),
  matchMock: vi.fn(),
}));
vi.mock('@/lib/ai/matching/cards/retrieval', () => ({
  matchCardCandidates: cardsMock,
}));
vi.mock('@/lib/ai/matching/match-ingredients', () => ({
  matchIngredients: matchMock,
}));

import {
  completedMealItems,
  createStreamedMatching,
} from '../streamed-matching';

const result = (label: string): IngredientV2MatchResult =>
  ({ ingredientIndex: -1, candidates: [{ label }] }) as never;

describe('completedMealItems', () => {
  it('returns only the meal items whose objects have closed', () => {
    const partial =
      '{"plan":"x","isFood":true,"mealItems":[{"name":"Cơm","ingredients":[{"rawName":"cơm","canonicalName":"Cơm"}]},{"name":"Canh {chua}","ingredients":[{"rawName":"cá';
    expect(
      completedMealItems(partial).map((i) => i.ingredients?.[0].rawName)
    ).toEqual(['cơm']);
  });

  it('reads braces inside strings as text and stops at the end of the array', () => {
    const done =
      '{"mealItems":[{"name":"A \\"}\\" B","ingredients":[]},{"name":"C","ingredients":[]}],"mealSlot":"lunch"}';
    expect(completedMealItems(done)).toHaveLength(2);
    expect(completedMealItems('{"plan":"no items yet')).toEqual([]);
  });
});

describe('createStreamedMatching', () => {
  it('reuses what the stream fetched and matches only what changed', async () => {
    cardsMock.mockImplementation(async (ings: { rawName: string }[]) =>
      ings.map((i) => result(`early:${i.rawName}`))
    );
    matchMock.mockImplementation(async (ings: { rawName: string }[]) =>
      ings.map((i) => result(`late:${i.rawName}`))
    );
    const streamed = createStreamedMatching({} as AppDb, {} as GeminiClient);
    streamed.onChunk(
      '{"mealItems":[{"name":"Cơm","ingredients":[{"rawName":"cơm","canonicalName":"Cơm"}]},'
    );
    // The final decomposition capitalises names and adds a dish the stream never closed.
    const out = await streamed.match(
      [
        { rawName: 'Cơm', canonicalName: 'Cơm' },
        { rawName: 'Cá kho', canonicalName: 'Cá kho' },
      ],
      [null, null],
      { k: 8, concurrency: 4 }
    );
    expect(
      out.map((r) => (r.candidates[0] as never as { label: string }).label)
    ).toEqual(['early:Cơm', 'late:Cá kho']);
    expect(out.map((r) => r.ingredientIndex)).toEqual([0, 1]);
    expect(matchMock).toHaveBeenCalledTimes(1);
  });
});

describe('streamed matching batches', () => {
  it('runs one batch at a time, the next taking everything that streamed in meanwhile', async () => {
    const batches: string[][] = [];
    let release: () => void = () => {};
    cardsMock.mockReset();
    cardsMock.mockImplementation((ings: { rawName: string }[]) => {
      batches.push(ings.map((i) => i.rawName));
      return batches.length === 1
        ? new Promise((resolve) => {
            release = () => resolve(ings.map((i) => result(i.rawName)));
          })
        : Promise.resolve(ings.map((i) => result(i.rawName)));
    });
    const streamed = createStreamedMatching({} as AppDb, {} as GeminiClient);
    const item = (n: string) =>
      `{"name":"${n}","ingredients":[{"rawName":"${n}","canonicalName":"${n}"}]}`;
    streamed.onChunk(`{"mealItems":[${item('a')},`);
    streamed.onChunk(`{"mealItems":[${item('a')},${item('b')},`);
    streamed.onChunk(`{"mealItems":[${item('a')},${item('b')},${item('c')},`);
    expect(batches).toEqual([['A']]);
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(batches).toEqual([['A'], ['B', 'C']]);
  });
});
