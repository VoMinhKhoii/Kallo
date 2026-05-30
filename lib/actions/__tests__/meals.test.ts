import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NULL_BOUNDED_NUTRITION,
  NULL_NUTRITION_VALUES,
} from '@/lib/ai/__tests__/test-helpers';
import type { BoundedNutrition, PipelineResult } from '@/lib/ai/types';

// ---------------------------------------------------------------------------
// Mocks
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
  requireAuthAndProfile: vi.fn().mockResolvedValue({
    user: mockUser,
    profile: {
      goal: 'cutting',
      aggression: '0.5',
    },
  }),
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
    loggedAt: 'pendingAnalyses.loggedAt',
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
  loadMealsByDate,
  loadPendingAnalysesByDate,
} from '@/lib/actions/meals';
import { requireAuthAndProfile } from '@/lib/auth';

// Valid v4 UUIDs (Zod v4 validates version+variant bits)
const UUID_1 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const UUID_2 = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const UUID_MEAL = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const LOGGED_AT = new Date('2026-04-05T17:30:00.000Z');

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
            loggedAt: LOGGED_AT,
          },
        ]),
      }),
    });

    // INSERT meals RETURNING
    const mealReturning = vi.fn().mockResolvedValue([{ id: UUID_MEAL }]);
    const mealValues = vi.fn().mockReturnValue({ returning: mealReturning });
    mockTxInsert.mockImplementation((_table: unknown) => {
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

  it('persists the client-provided meal id when supplied', async () => {
    const capturedValues: unknown[] = [];

    mockTxDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: UUID_2,
            userId: mockUser.id,
            rawInput: 'Phở bò',
            pipelineResult: JSON.parse(JSON.stringify(samplePipelineResult)),
            loggedAt: LOGGED_AT,
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

    await confirmAndSaveMealAction({ analysisId: UUID_2, mealId: UUID_MEAL });

    const mealRow = capturedValues[0] as Record<string, unknown>;
    expect(mealRow.id).toBe(UUID_MEAL);
  });

  it('resolves cheat-meal nutrition from slider levels and inserts zero items', async () => {
    const capturedValues: Record<string, unknown>[] = [];
    const cheatSpec = {
      rationale: 'Korean BBQ — meat-forward, fairly rich.',
      mealSlot: 'dinner' as const,
      confidence: 'medium' as const,
      sliders: [
        {
          key: 'protein' as const,
          label: 'Thịt',
          defaultLevel: 5,
          anchors: [
            { level: 0, label: 'không', proteinG: 0 },
            { level: 10, label: 'tiệc thịt', proteinG: 120 },
          ],
        },
        {
          key: 'fat' as const,
          label: 'Độ béo',
          defaultLevel: 5,
          anchors: [
            { level: 0, label: 'nạc', fatG: 0 },
            { level: 10, label: 'mỡ', fatG: 80 },
          ],
        },
        {
          key: 'drinks' as const,
          label: 'Đồ uống',
          defaultLevel: 0,
          anchors: [
            { level: 0, label: 'không', alcoholG: 0 },
            { level: 10, label: 'bia', alcoholG: 40 },
          ],
        },
      ],
    };

    mockTxDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: UUID_1,
            userId: mockUser.id,
            rawInput: 'Korean BBQ buffet',
            entryMode: 'cheat',
            pipelineResult: { entryMode: 'cheat', spec: cheatSpec },
            loggedAt: LOGGED_AT,
          },
        ]),
      }),
    });

    mockTxInsert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        capturedValues.push(vals);
        return { returning: vi.fn().mockResolvedValue([{ id: UUID_MEAL }]) };
      }),
    }));

    const result = await confirmAndSaveMealAction({
      analysisId: UUID_1,
      // protein 10 → 120g, fat 5 → 40g, drinks 10 → 40g alcohol
      levels: { protein: 10, fat: 5, drinks: 10 },
    });

    expect(result).toEqual({ mealId: UUID_MEAL });
    // Only the meals row — no meal_items insert for a cheat meal.
    expect(mockTxInsert).toHaveBeenCalledTimes(1);

    const mealRow = capturedValues[0];
    expect(mealRow.entryMode).toBe('cheat');
    expect(mealRow.proteinG).toBe(120);
    expect(mealRow.fatG).toBe(40);
    expect(mealRow.alcoholG).toBe(40);
    // 4*120 + 9*40 + 7*40 = 480 + 360 + 280 = 1120
    expect(mealRow.caloriesKcal).toBe(1120);
    expect(mealRow.estimateRationale).toBe(cheatSpec.rationale);
    expect(mealRow.mealSlot).toBe('dinner');
  });

  it('should reject invalid UUID', async () => {
    await expect(
      confirmAndSaveMealAction({ analysisId: 'not-a-uuid' })
    ).rejects.toThrow();
  });

  it('should reject invalid persisted profile nutrition settings', async () => {
    vi.mocked(requireAuthAndProfile).mockResolvedValueOnce({
      user: mockUser,
      profile: {
        goal: 'recomp',
        aggression: '0.5',
      } as never,
    } as never);

    mockTxDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: UUID_1,
            userId: mockUser.id,
            rawInput: 'Phở bò',
            pipelineResult: samplePipelineResult,
            loggedAt: LOGGED_AT,
          },
        ]),
      }),
    });

    await expect(
      confirmAndSaveMealAction({ analysisId: UUID_1 })
    ).rejects.toThrow();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('should persist goal-adjusted macros as single values', async () => {
    const capturedValues: unknown[] = [];

    mockTxDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: UUID_2,
            userId: mockUser.id,
            rawInput: 'Phở bò',
            pipelineResult: JSON.parse(JSON.stringify(samplePipelineResult)),
            loggedAt: LOGGED_AT,
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
    expect(firstItem.caloriesKcal).toBe(620); // cutting @ 0.5 => 600 + 0.5 * (640 - 600)
    expect(firstItem.proteinG).toBe(9); // cutting @ 0.5 => 10 + 0.5 * (8 - 10)

    const mealRow = capturedValues[0] as Record<string, unknown>;
    expect(mealRow.loggedAt).toBe(LOGGED_AT);
    expect(mealRow.caloriesKcal).toBe(830);
    expect(mealRow.proteinG).toBe(34);
  });

  it('should persist gram-scaled micros as single values', async () => {
    const capturedValues: unknown[] = [];
    const pipelineResult = JSON.parse(
      JSON.stringify(samplePipelineResult)
    ) as PipelineResult;
    pipelineResult.mealItems[0].ingredients[0].boundedNutrition.sodiumMg = {
      low: 120,
      mid: 120,
      high: 120,
    };

    mockTxDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: UUID_2,
            userId: mockUser.id,
            rawInput: 'Phở bò',
            pipelineResult,
            loggedAt: LOGGED_AT,
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
      edits: [{ mealItemOrder: 0, ingredientIndex: 0, newGrams: 400 }],
    });

    const mealItemRows = capturedValues[1] as Record<string, unknown>[];
    const firstItem = mealItemRows[0] as Record<string, unknown>;
    expect(firstItem.sodiumMg).toBe(240);

    const mealRow = capturedValues[0] as Record<string, unknown>;
    expect(mealRow.sodiumMg).toBe(240);
  });

  it('scales every ingredient when a whole-dish edit omits ingredientIndex', async () => {
    const capturedValues: unknown[] = [];

    mockTxDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: UUID_2,
            userId: mockUser.id,
            rawInput: 'Phở bò',
            pipelineResult: JSON.parse(JSON.stringify(samplePipelineResult)),
            loggedAt: LOGGED_AT,
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

    // Dish total is 200g + 100g = 300g; doubling to 600g should scale both
    // ingredients by 2x (goal adjustment is linear, so outputs double too).
    await confirmAndSaveMealAction({
      analysisId: UUID_2,
      edits: [{ mealItemOrder: 0, newGrams: 600 }],
    });

    const mealItemRows = capturedValues[1] as Record<string, unknown>[];
    const [first, second] = mealItemRows;

    // Both ingredients scaled (the second proves it's a whole-dish edit).
    expect(first.estimatedGrams).toBe(400);
    expect(second.estimatedGrams).toBe(200);
    expect(first.caloriesKcal).toBe(620); // baseline 310 → 2x
    expect(second.caloriesKcal).toBe(420); // baseline 210 → 2x

    const mealRow = capturedValues[0] as Record<string, unknown>;
    expect(mealRow.caloriesKcal).toBe(1040); // baseline 520 → 2x
  });
});

describe('loadMealsByDate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns flat persisted nutrition for meals, groups, and ingredients', async () => {
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: UUID_MEAL,
                rawInput: 'Phở bò',
                mealSlot: 'lunch',
                confidenceOverall: 'high',
                loggedAt: new Date('2026-04-06T12:00:00.000Z'),
                caloriesKcal: 830,
                proteinG: 34,
                carbohydrateG: 125,
                fatG: 18,
                sodiumMg: 240,
              },
            ]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: UUID_1,
              mealId: UUID_MEAL,
              ingredientName: 'Bánh phở',
              mealItemName: 'Phở bò',
              mealItemOrder: 0,
              foodCompositionId: 'fc-1',
              estimatedGrams: 400,
              userFacingUnit: '1 tô',
              cookingMethod: 'luộc',
              matchConfidence: 0.9,
              caloriesKcal: 620,
              proteinG: 9,
              carbohydrateG: 125,
              fatG: 5,
              sodiumMg: 240,
            },
            {
              id: UUID_2,
              mealId: UUID_MEAL,
              ingredientName: 'Thịt bò',
              mealItemName: 'Phở bò',
              mealItemOrder: 0,
              foodCompositionId: 'fc-2',
              estimatedGrams: 100,
              userFacingUnit: null,
              cookingMethod: 'luộc',
              matchConfidence: 0.85,
              caloriesKcal: 210,
              proteinG: 25,
              carbohydrateG: null,
              fatG: 13,
              sodiumMg: null,
            },
          ]),
        }),
      });

    const meals = await loadMealsByDate({
      date: '2026-04-06',
      timezoneOffset: 0,
    });

    expect(meals).toHaveLength(1);
    expect(meals[0]?.nutrition.caloriesKcal).toBe(830);
    expect(meals[0]?.nutrition.proteinG).toBe(34);
    expect(meals[0]?.mealItemGroups[0]?.nutrition.caloriesKcal).toBe(830);
    expect(meals[0]?.mealItemGroups[0]?.nutrition.sodiumMg).toBe(240);
    expect(
      meals[0]?.mealItemGroups[0]?.ingredients[0]?.nutrition.proteinG
    ).toBe(9);
  });
});

describe('loadPendingAnalysesByDate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pending confirmations scoped to the selected local day', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            {
              id: UUID_1,
              rawInput: 'Phở bò',
              loggedAt: LOGGED_AT,
              pipelineResult: samplePipelineResult,
            },
          ]),
        }),
      }),
    });

    const pending = await loadPendingAnalysesByDate({
      date: '2026-04-06',
      timezoneOffset: -420,
    });

    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe(UUID_1);
    expect(pending[0]?.rawInput).toBe('Phở bò');
    expect(pending[0]?.loggedAt).toBe(LOGGED_AT.toISOString());
    expect(pending[0]?.parsedMeal.mealName).toBe('Phở bò');
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
  it('returns merged confirmed and pending dates', async () => {
    const { db } = await import('@/lib/db');
    (db.selectDistinctOn as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi
              .fn()
              .mockResolvedValue([
                { date: '2026-04-06' },
                { date: '2026-04-05' },
              ]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi
              .fn()
              .mockResolvedValue([
                { date: '2026-04-07' },
                { date: '2026-04-06' },
              ]),
          }),
        }),
      });

    const dates = await loadMealDates({ timezoneOffset: 0 });
    expect(dates).toEqual(['2026-04-07', '2026-04-06', '2026-04-05']);
  });
});
