import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearNutritionCache } from '@/lib/ai/cache/nutrition-cache';
import {
  attachCandidateNutrition,
  type IngredientV2MatchResult,
} from '@/lib/ai/matching/candidate';
import type { AppDb } from '@/lib/infra/db/client';

beforeEach(() => clearNutritionCache());

const candidates = (ids: string[]): IngredientV2MatchResult[] => [
  {
    ingredientIndex: 0,
    candidates: ids.map((id) => ({
      info: { foodCompositionId: id } as never,
      nutrition: null,
      inediblePct: null,
      prompt: { name: id, nameEn: null, score: 1 },
    })),
  },
];

describe('candidate nutrition demand cache', () => {
  it('repeated candidate sets cost zero extra queries, including known NULLs', async () => {
    const execute = vi.fn().mockResolvedValue([
      {
        id: 'numeric',
        calories_kcal: '100',
        inedible_portion_pct: '12.5',
        type_en: 'Meat',
      },
      { id: 'null', calories_kcal: '50', inedible_portion_pct: null },
      { id: 'zero', calories_kcal: '70', inedible_portion_pct: '0' },
    ]);
    const db = { execute } as unknown as AppDb;
    const first = candidates(['numeric', 'null', 'zero']);
    await attachCandidateNutrition(first, db);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(first[0].candidates.map((c) => c.inediblePct)).toEqual([
      12.5,
      null,
      0,
    ]);
    expect(first[0].candidates[0].info.foodGroupEn).toBe('Meat');
    const repeat = candidates(['numeric', 'null', 'zero']);
    await attachCandidateNutrition(repeat, db);
    expect(repeat).toEqual(first);
    expect(execute).toHaveBeenCalledTimes(1);

    execute.mockResolvedValueOnce([
      { id: 'new', calories_kcal: '20', inedible_portion_pct: null },
    ]);
    const extended = candidates(['numeric', 'null', 'zero', 'new']);
    await attachCandidateNutrition(extended, db);
    expect(execute).toHaveBeenCalledTimes(2);
    const query = JSON.stringify(execute.mock.calls[1][0]);
    expect(query).toContain('new');
    expect(query).not.toContain('numeric');
    expect(query).not.toContain('zero');
    await attachCandidateNutrition(candidates(['new', 'null']), db);
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
