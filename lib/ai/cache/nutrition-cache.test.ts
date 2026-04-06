import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearNutritionCache,
  getNutritionCache,
  getNutritionCacheStats,
} from './nutrition-cache';

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

function createMockDb(rows: Record<string, unknown>[]): any {
  return {
    execute: vi.fn().mockResolvedValue(rows),
  };
}

const ROW_CHICKEN: Record<string, unknown> = {
  id: 'fc-001',
  calories_kcal: 165,
  protein_g: 31,
  carbohydrate_g: 0,
  fat_g: 3.6,
  fiber_g: null,
  sodium_mg: 74,
  calcium_mg: 15,
  iron_mg: 1.1,
  magnesium_mg: 29,
  phosphorus_mg: 220,
  potassium_mg: 256,
  zinc_mg: 1.0,
  copper_mcg: null,
  manganese_mg: null,
  beta_carotene_mcg: null,
  vitamin_a_mcg: null,
  vitamin_d_mcg: null,
  vitamin_e_mg: null,
  vitamin_k_mcg: null,
  vitamin_c_mg: null,
  vitamin_b1_mg: null,
  vitamin_b2_mg: null,
  vitamin_pp_mg: null,
  vitamin_b5_mg: null,
  vitamin_b6_mg: null,
  vitamin_b9_mcg: null,
  vitamin_b12_mcg: null,
  vitamin_h_mcg: null,
};

const ROW_RICE: Record<string, unknown> = {
  ...ROW_CHICKEN,
  id: 'fc-002',
  calories_kcal: 130,
  protein_g: 2.7,
  carbohydrate_g: 28,
  fat_g: 0.3,
};

beforeEach(() => {
  clearNutritionCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getNutritionCache', () => {
  it('loads all rows from DB on first call', async () => {
    const db = createMockDb([ROW_CHICKEN, ROW_RICE]);
    const cache = await getNutritionCache(db);

    expect(db.execute).toHaveBeenCalledOnce();
    expect(cache.size).toBe(2);
    expect(cache.get('fc-001')?.caloriesKcal).toBe(165);
    expect(cache.get('fc-002')?.proteinG).toBe(2.7);
  });

  it('returns from in-memory cache on second call (no DB hit)', async () => {
    const db = createMockDb([ROW_CHICKEN]);

    await getNutritionCache(db);
    const cache = await getNutritionCache(db);

    // DB was called only once despite two getNutritionCache calls
    expect(db.execute).toHaveBeenCalledOnce();
    expect(cache.size).toBe(1);
  });

  it('singleton behavior: same map instance returned', async () => {
    const db = createMockDb([ROW_CHICKEN]);

    const cache1 = await getNutritionCache(db);
    const cache2 = await getNutritionCache(db);

    expect(cache1).toBe(cache2);
  });

  it('deduplicates concurrent initializations', async () => {
    const db = createMockDb([ROW_CHICKEN, ROW_RICE]);

    // Simulate burst of concurrent first-requests
    const [c1, c2, c3] = await Promise.all([
      getNutritionCache(db),
      getNutritionCache(db),
      getNutritionCache(db),
    ]);

    expect(db.execute).toHaveBeenCalledOnce();
    expect(c1.size).toBe(2);
    expect(c1).toBe(c2);
    expect(c1).toBe(c3);
  });

  it('returns empty cache and allows retry on DB error', async () => {
    const db = {
      execute: vi
        .fn()
        .mockRejectedValueOnce(new Error('DB unavailable'))
        .mockResolvedValueOnce([ROW_CHICKEN]),
    } as any;

    // First call — DB error → returns empty cache
    const cache1 = await getNutritionCache(db);
    expect(cache1.size).toBe(0);

    // Second call — retry succeeds
    const cache2 = await getNutritionCache(db);
    expect(cache2.size).toBe(1);
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  it('getNutritionCacheStats reflects loaded state', async () => {
    expect(getNutritionCacheStats()).toEqual({ size: 0, initialized: false });

    const db = createMockDb([ROW_CHICKEN, ROW_RICE]);
    await getNutritionCache(db);

    expect(getNutritionCacheStats()).toEqual({ size: 2, initialized: true });
  });
});
