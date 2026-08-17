import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PipelineResult } from '@/lib/ai/types/result';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockTxDelete, mockTxInsert, mockTxUpdate, mockTxSelect, mockTx } =
  vi.hoisted(() => {
    const mockTxDelete = vi.fn();
    const mockTxInsert = vi.fn();
    const mockTxUpdate = vi.fn();
    const mockTxSelect = vi.fn(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(
          // Thenable + .for('update') — the share helper locks the row.
          Object.assign(Promise.resolve([{ autoShareToCircle: true }]), {
            for: vi.fn().mockResolvedValue([{ autoShareToCircle: true }]),
          })
        ),
      }),
    }));
    return {
      mockTxDelete,
      mockTxInsert,
      mockTxUpdate,
      mockTxSelect,
      mockTx: {
        delete: mockTxDelete,
        insert: mockTxInsert,
        update: mockTxUpdate,
        select: mockTxSelect,
      },
    };
  });

vi.mock('@/lib/auth/session', async () => {
  const { MOCK_USER, MOCK_PROFILE } = await import('./meal-doubles');
  return {
    requireAuthAndProfile: vi
      .fn()
      .mockResolvedValue({ user: MOCK_USER, profile: MOCK_PROFILE }),
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx)
    ),
    select: vi.fn(),
    delete: vi.fn(),
    selectDistinctOn: vi.fn(),
  },
}));

vi.mock('@/lib/db/schema', async () => (await import('./meal-doubles')).schema);

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import { confirmAndSaveMealAction } from '@/lib/actions/meals/confirm-and-save';
import { requireAuthAndProfile } from '@/lib/auth/session';
import {
  LOGGED_AT,
  makeBoundedNutrition,
  mockInsertRouting,
  MOCK_USER as mockUser,
  samplePipelineResult,
  UUID_1,
  UUID_2,
  UUID_MEAL,
} from './meal-doubles';

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

    // INSERT routing: meals + mealShares (default circle share) + mealItems
    mockTxInsert.mockImplementation(mockInsertRouting());

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

    // Returns the saved meal alongside the id so the client can reconcile its
    // optimistic card without a follow-up day refetch.
    expect(result).toMatchObject({ mealId: UUID_MEAL });
    expect(result.meal.id).toBe(UUID_MEAL);
    expect(result.meal.nutrition).toBeDefined();
    // Shared to circle by default — the confirm response carries the share.
    expect(result.meal.share).toEqual({
      shareId: 'share-1',
      visibility: 'circle',
    });
    // INSERT called three times: meals + mealShares + mealItems
    expect(mockTxInsert).toHaveBeenCalledTimes(3);
  });

  it('does not share a confirmed meal when the profile opts out', async () => {
    vi.mocked(requireAuthAndProfile).mockResolvedValueOnce({
      user: mockUser,
      profile: { goal: 'cutting', aggression: '0.5' },
    } as never);
    // The opt-out is read in-transaction, not from the auth-time profile row.
    mockTxSelect.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(
          // Thenable + .for('update') — the share helper locks the row.
          Object.assign(Promise.resolve([{ autoShareToCircle: false }]), {
            for: vi.fn().mockResolvedValue([{ autoShareToCircle: false }]),
          })
        ),
      }),
    }));
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
    mockTxInsert.mockImplementation(mockInsertRouting());

    const result = await confirmAndSaveMealAction({ analysisId: UUID_1 });

    const insertedIntoMealShares = mockTxInsert.mock.calls.some(
      ([table]) => table?.id === 'mealShares.id'
    );
    expect(insertedIntoMealShares).toBe(false);
    expect(result.meal.share).toBeNull();
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

    mockTxInsert.mockImplementation(mockInsertRouting(capturedValues));

    await confirmAndSaveMealAction({ analysisId: UUID_2, mealId: UUID_MEAL });

    const mealRow = capturedValues[0] as Record<string, unknown>;
    expect(mealRow.id).toBe(UUID_MEAL);
  });

  it('resolves cheat-meal nutrition from slider levels and inserts zero items', async () => {
    const capturedValues: Record<string, unknown>[] = [];
    const cheatSpec = {
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

    mockTxInsert.mockImplementation(
      mockInsertRouting(capturedValues as unknown[])
    );

    const result = await confirmAndSaveMealAction({
      analysisId: UUID_1,
      // protein 10 → 120g, fat 5 → 40g, drinks 10 → 40g alcohol
      levels: { protein: 10, fat: 5, drinks: 10 },
    });

    expect(result.mealId).toBe(UUID_MEAL);
    // The confirm response carries the authoritative saved cheat meal so the
    // client reconciles in place (no day refetch) — same contract as precise.
    expect(result.meal.entryMode).toBe('cheat');
    expect(result.meal.alcoholG).toBe(40);
    expect(result.meal.nutrition.caloriesKcal).toBe(1120);
    expect(result.meal.mealItemGroups).toEqual([]);
    // Shared to circle by default, just like a precise meal.
    expect(result.meal.share).toEqual({
      shareId: 'share-1',
      visibility: 'circle',
    });
    // meals row + mealShares row — no meal_items insert for a cheat meal.
    expect(mockTxInsert).toHaveBeenCalledTimes(2);

    const mealRow = capturedValues[0];
    expect(mealRow.entryMode).toBe('cheat');
    expect(mealRow.proteinG).toBe(120);
    expect(mealRow.fatG).toBe(40);
    expect(mealRow.alcoholG).toBe(40);
    // 4*120 + 9*40 + 7*40 = 480 + 360 + 280 = 1120
    expect(mealRow.caloriesKcal).toBe(1120);
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

    mockTxInsert.mockImplementation(mockInsertRouting(capturedValues));

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

    mockTxInsert.mockImplementation(mockInsertRouting(capturedValues));

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

    mockTxInsert.mockImplementation(mockInsertRouting(capturedValues));

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

  it('keeps nutrition intact when a gram edit targets a zero-base dish', async () => {
    // A relogged item whose source row had null `estimated_grams` reaches the
    // pipeline result with estimatedGrams 0. A gram edit on it must NOT scale
    // its (authoritative, copied) macros to zero — it records the new grams and
    // leaves nutrition unchanged.
    const capturedValues: unknown[] = [];
    const pipelineResult = JSON.parse(
      JSON.stringify(samplePipelineResult)
    ) as PipelineResult;
    // Single-ingredient dish with unknown weight but real, frozen macros.
    pipelineResult.mealItems[0].ingredients = [
      {
        ...pipelineResult.mealItems[0].ingredients[0],
        estimatedGrams: 0,
        rawEquivalentGrams: 0,
        boundedNutrition: makeBoundedNutrition({
          caloriesKcal: { low: 215, mid: 215, high: 215 },
          carbohydrateG: { low: 51, mid: 51, high: 51 },
        }),
      },
    ];

    mockTxDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: UUID_2,
            userId: mockUser.id,
            rawInput: 'Khoai lang',
            pipelineResult,
            loggedAt: LOGGED_AT,
          },
        ]),
      }),
    });
    mockTxInsert.mockImplementation(mockInsertRouting(capturedValues));

    await confirmAndSaveMealAction({
      analysisId: UUID_2,
      edits: [{ mealItemOrder: 0, newGrams: 150 }],
    });

    const mealItemRows = capturedValues[1] as Record<string, unknown>[];
    const firstItem = mealItemRows[0] as Record<string, unknown>;
    // Grams recorded, macros preserved (NOT zeroed).
    expect(firstItem.estimatedGrams).toBe(150);
    expect(firstItem.caloriesKcal).toBe(215);
    expect(firstItem.carbohydrateG).toBe(51);
  });
});
