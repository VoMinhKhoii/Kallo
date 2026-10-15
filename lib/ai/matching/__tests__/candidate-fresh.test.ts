import { describe, expect, it, vi } from 'vitest';
import type { IngredientV2MatchResult } from '@/lib/ai/matching/candidate';
import type { AppDb } from '@/lib/infra/db/client';

vi.mock('@/lib/ai/cache/nutrition-cache', () => ({
  fetchInediblePctForIds: vi.fn(async () => new Map()),
  getInedibleCache: vi.fn(async () => new Map()),
  isNutritionCacheInitialized: vi.fn(() => true),
}));
vi.mock('@/lib/ai/matching/nutrition-batch', () => ({
  batchFetchNutrition: vi.fn(),
}));

const { attachCandidateNutrition } = await import(
  '@/lib/ai/matching/candidate'
);
const { batchFetchNutrition } = await import(
  '@/lib/ai/matching/nutrition-batch'
);

const candidate = (id: string) => ({
  info: { foodCompositionId: id } as never,
  nutrition: null,
  inediblePct: null,
  prompt: { name: id, nameEn: null, score: 1 },
});

describe('attachCandidateNutrition (fresh, for search-artifact candidates)', () => {
  it('reads rows past the cache in one query and drops candidates Postgres no longer has', async () => {
    const execute = vi.fn(async () => [
      {
        id: 'live',
        calories_kcal: '120',
        protein_g: '20',
        carbohydrate_g: '0',
        fat_g: '4',
        inedible_portion_pct: '15',
        type_en: 'Meat',
      },
      {
        id: 'no_inedible',
        calories_kcal: '50',
        protein_g: '1',
        carbohydrate_g: '10',
        fat_g: '0',
        inedible_portion_pct: null,
        type_en: '',
      },
    ]);
    const results: IngredientV2MatchResult[] = [
      {
        ingredientIndex: 0,
        candidates: [candidate('live'), candidate('deleted')],
      },
      { ingredientIndex: 1, candidates: [candidate('no_inedible')] },
    ];

    await attachCandidateNutrition(results, { execute } as unknown as AppDb, {
      fresh: true,
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(batchFetchNutrition).not.toHaveBeenCalled();
    expect(results[0].candidates.map((c) => c.info.foodCompositionId)).toEqual([
      'live',
    ]);
    const live = results[0].candidates[0];
    expect(live.nutrition?.caloriesKcal).toBe(120);
    expect(live.inediblePct).toBe(15);
    expect(live.info.foodGroupEn).toBe('Meat');
    // Liveness is the row's presence, not its inedible %, which most rows lack.
    const kept = results[1].candidates[0];
    expect(kept.inediblePct).toBeNull();
    expect(kept.info.foodGroupEn).toBeUndefined();
  });

  it('keeps the cached path when not fresh', async () => {
    vi.mocked(batchFetchNutrition).mockResolvedValueOnce(new Map());
    const execute = vi.fn();
    const results: IngredientV2MatchResult[] = [
      { ingredientIndex: 0, candidates: [candidate('a')] },
    ];
    await attachCandidateNutrition(results, { execute } as unknown as AppDb);
    expect(batchFetchNutrition).toHaveBeenCalled();
    expect(results[0].candidates).toHaveLength(1);
  });
});
