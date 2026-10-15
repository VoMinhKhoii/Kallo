import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearNutritionCache,
  getNutritionCache,
  isNutritionCacheInitialized,
} from '@/lib/ai/cache/nutrition-cache';
import type { AppDb } from '@/lib/infra/db/client';
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
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('batchFetchNutrition', () => {
  it('query-delay model: cold/new IDs cost one 20ms read, repeat IDs cost zero', async () => {
    vi.useFakeTimers();
    let queryNumber = 0;
    const execute = vi.fn(
      (query: unknown) =>
        new Promise((resolve) => {
          queryNumber++;
          expect(sqlText(query)).toContain('WHERE id IN');
          setTimeout(
            () => resolve(queryNumber === 1 ? [ROW_CHICKEN] : [ROW_RICE]),
            20
          );
        })
    );
    const db = { execute } as unknown as AppDb;
    const start = Date.now();
    const cold = batchFetchNutrition(['fc-001'], db);
    await vi.advanceTimersByTimeAsync(20);
    await cold;
    expect(Date.now() - start).toBe(20);
    const beforeRepeat = Date.now();
    await batchFetchNutrition(['fc-001'], db);
    expect(Date.now() - beforeRepeat).toBe(0);
    expect(execute).toHaveBeenCalledTimes(1);
    // No 126KB catalog query is queued after the meal query returns.
    await vi.runAllTimersAsync();
    expect(execute).toHaveBeenCalledTimes(1);
    const beforeNew = Date.now();
    const newId = batchFetchNutrition(['fc-002'], db);
    await vi.advanceTimersByTimeAsync(20);
    expect((await newId).get('fc-002')?.caloriesKcal).toBe(130);
    expect(Date.now() - beforeNew).toBe(20);
    expect(execute).toHaveBeenCalledTimes(2);
  });
  it('returns empty for an empty id list', async () => {
    const db = { execute: vi.fn() } as unknown as AppDb;
    const map = await batchFetchNutrition([], db);
    expect(map.size).toBe(0);
    expect(
      (db as unknown as { execute: ReturnType<typeof vi.fn> }).execute
    ).not.toHaveBeenCalled();
  });

  it('cold path: one scoped query, no bulk warm, then zero queries for repeat IDs', async () => {
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

    expect(isNutritionCacheInitialized()).toBe(false);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(sqlText(execute.mock.calls[0][0])).toContain('WHERE id IN');
    expect(sqlText(execute.mock.calls[0][0])).not.toContain('source_id = 1');
    const repeated = await batchFetchNutrition(['fc-001'], db);
    expect(repeated.get('fc-001')).toEqual(map.get('fc-001'));
    expect(execute).toHaveBeenCalledTimes(1);
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
