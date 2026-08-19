import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — the copy runs entirely inside one transaction.
// ---------------------------------------------------------------------------

const { mockTxInsert, mockTxSelect, mockTx } = vi.hoisted(() => {
  const mockTxInsert = vi.fn();
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
    mockTxInsert,
    mockTxSelect,
    mockTx: {
      delete: vi.fn(),
      insert: mockTxInsert,
      update: vi.fn(),
      select: mockTxSelect,
    },
  };
});

vi.mock('@/lib/infra/auth/session', async () => {
  const { MOCK_USER, MOCK_PROFILE } = await import('./meal-doubles');
  return {
    requireAuthAndProfile: vi
      .fn()
      .mockResolvedValue({ user: MOCK_USER, profile: MOCK_PROFILE }),
  };
});

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx)
    ),
    select: vi.fn(),
    delete: vi.fn(),
    selectDistinctOn: vi.fn(),
  },
}));

vi.mock(
  '@/lib/infra/db/schema',
  async () => (await import('./meal-doubles')).schema
);

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import { duplicateMealAction } from '@/lib/actions/meals/duplicate-meal';
import {
  LOGGED_AT,
  mockInsertRouting,
  MOCK_USER as mockUser,
  UUID_1,
  UUID_2,
  UUID_MEAL,
} from './meal-doubles';

describe('duplicateMealAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function queueMealLookup(rows: unknown[]) {
    const limitResult = Object.assign(Promise.resolve(rows), {
      for: vi.fn().mockResolvedValue(rows),
    });
    mockTxSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue(limitResult),
        }),
      }),
    });
  }
  function queueItemLookup(rows: unknown[]) {
    mockTxSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    });
  }
  function sourceMeal(overrides: Record<string, unknown> = {}) {
    return {
      id: UUID_MEAL,
      userId: mockUser.id,
      rawInput: 'Phở bò',
      mealSlot: 'lunch',
      confidenceOverall: 'high',
      loggedAt: LOGGED_AT,
      entryMode: 'precise',
      alcoholG: 12,
      portionFactor: 1,
      caloriesKcal: 520,
      proteinG: 31,
      carbohydrateG: 60,
      fatG: 14,
      ...overrides,
    };
  }
  function sourceItem(overrides: Record<string, unknown> = {}) {
    return {
      id: UUID_1,
      mealId: UUID_MEAL,
      ingredientName: 'Bánh phở',
      mealItemName: 'Phở bò',
      mealItemOrder: 0,
      foodCompositionId: 'fc-1',
      estimatedGrams: 200,
      userFacingUnit: '1 tô',
      cookingMethod: 'luộc',
      matchConfidence: 0.9,
      caloriesKcal: 300,
      proteinG: 5,
      carbohydrateG: 60,
      fatG: 2,
      ...overrides,
    };
  }

  // `.values()` captures the inserted meal/item rows; the meals insert chains
  // `.returning` and the item insert is awaited directly (awaiting the plain
  // object is a no-op). The default share-to-circle insert on mealShares is
  // routed to its own chain so it never lands in `captured`.
  function captureInserts(captured: unknown[]) {
    mockTxInsert.mockImplementation(mockInsertRouting(captured, UUID_2));
  }

  it('rejects a meal that belongs to another user (userId-scoped lookup)', async () => {
    queueMealLookup([]); // scoped lookup finds nothing for this user

    await expect(
      duplicateMealAction({
        mealId: UUID_MEAL,
        loggedDate: '2026-06-24',
        timezoneOffset: -420,
      })
    ).rejects.toThrow('không thuộc về bạn');

    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('refuses to duplicate a cheat meal', async () => {
    queueMealLookup([sourceMeal({ entryMode: 'cheat' })]);

    await expect(
      duplicateMealAction({
        mealId: UUID_MEAL,
        loggedDate: '2026-06-24',
        timezoneOffset: -420,
      })
    ).rejects.toThrow('bữa xả');
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('copies the items verbatim into a new meal with fresh ids', async () => {
    queueMealLookup([sourceMeal()]);
    queueItemLookup([
      sourceItem(),
      sourceItem({
        id: UUID_2,
        ingredientName: 'Thịt bò',
        estimatedGrams: 100,
        caloriesKcal: 220,
        proteinG: 26,
        carbohydrateG: 0,
        fatG: 12,
      }),
    ]);

    const inserts: unknown[] = [];
    captureInserts(inserts);

    const result = await duplicateMealAction({
      mealId: UUID_MEAL,
      newMealId: UUID_2,
      loggedDate: '2026-06-24',
      timezoneOffset: -420,
    });

    // First insert = the new meal row; carries the source's numbers + alcohol.
    const mealInsert = inserts[0] as Record<string, unknown>;
    expect(mealInsert.id).toBe(UUID_2);
    expect(mealInsert.rawInput).toBe('Phở bò');
    expect(mealInsert.alcoholG).toBe(12);
    expect(mealInsert.entryMode).toBe('precise');

    // Second insert = the copied item rows, re-parented with fresh ids.
    const itemInserts = inserts[1] as Record<string, unknown>[];
    expect(itemInserts).toHaveLength(2);
    for (const row of itemInserts) {
      expect(row.mealId).toBe(UUID_2);
      expect(row.id).not.toBe(UUID_1);
      expect(row.id).not.toBe(UUID_2);
    }
    expect(itemInserts[0]?.foodCompositionId).toBe('fc-1');
    expect(itemInserts[0]?.estimatedGrams).toBe(200);
    expect(itemInserts[0]?.caloriesKcal).toBe(300);

    // The returned meal reconstructs both ingredients under the new id.
    expect(result.meal.id).toBe(UUID_2);
    expect(result.meal.nutrition.caloriesKcal).toBe(520);
    expect(result.meal.mealItemGroups[0]?.ingredients).toHaveLength(2);
    // A re-log is a brand-new meal, shared to circle by default.
    expect(result.meal.share).toEqual({
      shareId: 'share-1',
      visibility: 'circle',
    });
  });

  it('rejects an invalid mealId', async () => {
    await expect(
      duplicateMealAction({
        mealId: 'bad',
        loggedDate: '2026-06-24',
        timezoneOffset: -420,
      })
    ).rejects.toThrow();
  });
});
