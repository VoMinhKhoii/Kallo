import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NULL_BOUNDED_NUTRITION,
  NULL_NUTRITION_VALUES,
} from '@/lib/ai/__tests__/test-helpers';
import { NUTRITION_KEYS } from '@/lib/ai/constants';
import type { BoundedNutrition, PipelineResult } from '@/lib/ai/types';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures these exist before vi.mock factories run
// ---------------------------------------------------------------------------

const {
  mockUser,
  mockTxDelete,
  mockTxInsert,
  mockTxUpdate,
  mockDbSelect,
  mockDbDelete,
  mockTx,
} = vi.hoisted(() => {
  const mockTxDelete = vi.fn();
  const mockTxInsert = vi.fn();
  const mockTxUpdate = vi.fn();
  const mockDbSelect = vi.fn();
  const mockDbDelete = vi.fn();
  const mockTx = {
    delete: mockTxDelete,
    insert: mockTxInsert,
    update: mockTxUpdate,
  };
  return {
    mockUser: { id: 'user-123', email: 'test@example.com' },
    mockTxDelete,
    mockTxInsert,
    mockTxUpdate,
    mockDbSelect,
    mockDbDelete,
    mockTx,
  };
});

vi.mock('@/lib/auth', () => ({
  requireAuthAndProfile: vi.fn().mockResolvedValue({ user: mockUser }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx)
    ),
    select: mockDbSelect,
    delete: mockDbDelete,
    selectDistinctOn: vi.fn(),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  meals: { id: 'meals.id', userId: 'meals.userId', loggedAt: 'meals.loggedAt' },
  mealItems: { mealId: 'mealItems.mealId' },
  pendingAnalyses: {
    id: 'pendingAnalyses.id',
    userId: 'pendingAnalyses.userId',
    expiresAt: 'pendingAnalyses.expiresAt',
  },
  unmatchedIngredients: {
    queryText: 'unmatchedIngredients.queryText',
    mealId: 'unmatchedIngredients.mealId',
  },
}));

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import {
  confirmAndSaveMealAction,
  deleteMealAction,
  loadMealDates,
} from '@/lib/actions/meals';

// Valid v4 UUIDs (Zod v4 validates version+variant bits)
const UUID_1 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const UUID_2 = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const UUID_MEAL = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeBoundedNutrition(
  overrides: Partial<
    Record<keyof BoundedNutrition, { low: number; mid: number; high: number }>
  > = {}
): BoundedNutrition {
  const result = { ...NULL_BOUNDED_NUTRITION };
  for (const key of Object.keys(overrides) as (keyof BoundedNutrition)[]) {
    (result as Record<string, unknown>)[key] = overrides[key]!;
  }
  return result;
}

const samplePipelineResult: PipelineResult = {
  mealSlot: 'lunch',
  confidenceOverall: 'high',
  unmatchedIngredients: [],
  boundedNutrition: NULL_BOUNDED_NUTRITION,
  displayedNutrition: NULL_NUTRITION_VALUES,
  mealItems: [
    {
      name: 'Phở bò',
      boundedNutrition: NULL_BOUNDED_NUTRITION,
      displayedNutrition: NULL_NUTRITION_VALUES,
      ingredients: [
        {
          ingredientName: 'Bánh phở',
          foodCompositionId: 'fc-1',
          estimatedGrams: 200,
          rawEquivalentGrams: 200,
          userFacingUnit: '1 tô',
          cookingMethod: 'luộc',
          matchConfidence: 0.9,
          boundedNutrition: makeBoundedNutrition({
            caloriesKcal: { low: 280, mid: 300, high: 320 },
            proteinG: { low: 4, mid: 5, high: 6 },
            carbohydrateG: { low: 55, mid: 60, high: 65 },
            fatG: { low: 1, mid: 2, high: 3 },
          }),
          displayedNutrition: NULL_NUTRITION_VALUES,
        },
        {
          ingredientName: 'Thịt bò',
          foodCompositionId: 'fc-2',
          estimatedGrams: 100,
          rawEquivalentGrams: 100,
          userFacingUnit: null,
          cookingMethod: 'luộc',
          matchConfidence: 0.85,
          boundedNutrition: makeBoundedNutrition({
            caloriesKcal: { low: 180, mid: 200, high: 220 },
            proteinG: { low: 24, mid: 26, high: 28 },
            fatG: { low: 10, mid: 12, high: 14 },
          }),
          displayedNutrition: NULL_NUTRITION_VALUES,
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('confirmAndSaveMealAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw when pending analysis not found', async () => {
    // DELETE RETURNING returns empty array
    mockTxDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    });

    await expect(
      confirmAndSaveMealAction({ analysisId: UUID_1 })
    ).rejects.toThrow('Phân tích không tồn tại');
  });

  it('should insert meal and items inside transaction', async () => {
    // DELETE RETURNING returns the pending row
    mockTxDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: UUID_1,
            userId: mockUser.id,
            rawInput: 'Phở bò',
            pipelineResult: samplePipelineResult,
          },
        ]),
      }),
    });

    // INSERT meals RETURNING
    const mealReturning = vi.fn().mockResolvedValue([{ id: UUID_MEAL }]);
    const mealValues = vi.fn().mockReturnValue({ returning: mealReturning });
    mockTxInsert.mockImplementation((table: unknown) => {
      // First call = meals, second call = mealItems
      return { values: mealValues };
    });

    // UPDATE for unmatched — not called in this case (empty array)
    mockTxUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          catch: vi.fn(),
        }),
      }),
    });

    const result = await confirmAndSaveMealAction({
      analysisId: UUID_1,
    });

    expect(result).toEqual({ mealId: UUID_MEAL });
    // INSERT called twice: meals + mealItems
    expect(mockTxInsert).toHaveBeenCalledTimes(2);
  });

  it('should reject invalid UUID', async () => {
    await expect(
      confirmAndSaveMealAction({ analysisId: 'not-a-uuid' })
    ).rejects.toThrow();
  });

  it('should scale bounded nutrition when edits provided', async () => {
    const capturedValues: unknown[] = [];

    mockTxDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: UUID_2,
            userId: mockUser.id,
            rawInput: 'Phở bò',
            pipelineResult: JSON.parse(JSON.stringify(samplePipelineResult)),
          },
        ]),
      }),
    });

    mockTxInsert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((vals: unknown) => {
        capturedValues.push(vals);
        return {
          returning: vi.fn().mockResolvedValue([{ id: UUID_MEAL }]),
        };
      }),
    }));

    await confirmAndSaveMealAction({
      analysisId: UUID_2,
      edits: [
        { mealItemOrder: 0, ingredientIndex: 0, newGrams: 400 }, // double from 200g
      ],
    });

    // The meal_items insert should have scaled calories for the first ingredient
    // Original: 300 mid, doubled (400/200=2x) → 600 mid
    const mealItemRows = capturedValues[1] as Record<string, unknown>[];
    expect(mealItemRows).toBeDefined();
    expect(Array.isArray(mealItemRows)).toBe(true);

    const firstItem = mealItemRows[0] as Record<string, unknown>;
    const cal = firstItem.caloriesKcal as {
      low: number;
      mid: number;
      high: number;
    };
    expect(cal.mid).toBe(600); // 300 * 2
    expect(cal.low).toBe(560); // 280 * 2
    expect(cal.high).toBe(640); // 320 * 2
  });
});

describe('deleteMealAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw when meal not found', async () => {
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    });

    await expect(deleteMealAction({ mealId: UUID_1 })).rejects.toThrow(
      'Bữa ăn không tồn tại'
    );
  });

  it('should return success when meal deleted', async () => {
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: UUID_MEAL }]),
      }),
    });

    const result = await deleteMealAction({
      mealId: UUID_1,
    });
    expect(result).toEqual({ success: true });
  });

  it('should reject invalid mealId', async () => {
    await expect(deleteMealAction({ mealId: 'bad' })).rejects.toThrow();
  });
});

describe('loadMealDates', () => {
  it('should query and return dates', async () => {
    const { db } = await import('@/lib/db');
    const mockRows = [{ date: '2026-04-06' }, { date: '2026-04-05' }];
    (db.selectDistinctOn as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockRows),
        }),
      }),
    });

    const dates = await loadMealDates();
    expect(dates).toEqual(['2026-04-06', '2026-04-05']);
  });
});
