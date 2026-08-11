import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/lib/db';
import {
  clearNutritionCache,
  getNutritionCache,
  isNutritionCacheInitialized,
} from '../../cache/nutrition-cache';
import { batchFetchNutrition } from '../nutrition-batch';

/** Extract raw SQL text from a drizzle sql`` object for routing. */
function sqlText(query: unknown): string {
  return JSON.stringify(query);
}

const ROW_CHICKEN = {
  id: 'fc-001',
  calories_kcal: 165,
  protein_g: 31,
  carbohydrate_g: 0,
  fat_g: 3.6,
  type_en: 'Poultry Products',
};

const ROW_RICE = { ...ROW_CHICKEN, id: 'fc-002', calories_kcal: 130 };

beforeEach(() => clearNutritionCache());
afterEach(() => vi.restoreAllMocks());

describe('batchFetchNutrition', () => {
  it('returns empty for an empty id list', async () => {
    const db = { execute: vi.fn() } as unknown as AppDb;
    const map = await batchFetchNutrition([], db);
    expect(map.size).toBe(0);
    expect(
      (db as unknown as { execute: ReturnType<typeof vi.fn> }).execute
    ).not.toHaveBeenCalled();
  });

  it('cold path: finishes the meal-ID query before starting the background warm', async () => {
    let resolveMealIds: ((rows: unknown[]) => void) | undefined;
    // Routing mock: id-scoped fetch → the meal rows; full-table warm → both.
    const execute = vi.fn().mockImplementation((query: unknown) => {
      const text = sqlText(query);
      if (text.includes('WHERE id IN')) {
        return new Promise<unknown[]>((resolve) => {
          resolveMealIds = resolve;
        });
      }
      // Full-table warm (source_id = 1)
      return Promise.resolve([ROW_CHICKEN, ROW_RICE]);
    });
    const db = { execute } as unknown as AppDb;

    // Cache is cold on entry.
    expect(isNutritionCacheInitialized()).toBe(false);

    const mapPromise = batchFetchNutrition(['fc-001'], db);
    await vi.waitFor(() => expect(resolveMealIds).toBeDefined());
    expect(execute).toHaveBeenCalledTimes(1);

    resolveMealIds?.([ROW_CHICKEN]);
    const map = await mapPromise;
    expect(map.get('fc-001')?.caloriesKcal).toBe(165);
    expect(map.get('fc-001')?.foodGroupEn).toBe('Poultry Products');

    // Let the background warm settle, then confirm it ran.
    await vi.waitFor(() => expect(isNutritionCacheInitialized()).toBe(true));
    // Warm-up loaded both rows into the singleton.
    const warm = await getNutritionCache(db);
    expect(warm.size).toBe(2);
  });

  it('warm path: reads from the in-memory cache, no per-id query', async () => {
    // Prime the cache via the bulk warm first.
    const execute = vi.fn().mockResolvedValue([ROW_CHICKEN, ROW_RICE]);
    const db = { execute } as unknown as AppDb;
    await getNutritionCache(db);
    expect(isNutritionCacheInitialized()).toBe(true);
    execute.mockClear();

    const map = await batchFetchNutrition(['fc-001', 'fc-002'], db);
    expect(map.size).toBe(2);
    expect(map.get('fc-001')?.foodGroupEn).toBe('Poultry Products');
    // Both hit the warm cache — no residual DB query.
    expect(execute).not.toHaveBeenCalled();
  });
});
