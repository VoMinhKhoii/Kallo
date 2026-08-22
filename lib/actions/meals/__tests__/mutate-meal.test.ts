import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — delete runs on the `db` singleton, update inside a transaction.
// ---------------------------------------------------------------------------

const { mockDbDelete, mockTxDelete, mockTxUpdate, mockTxSelect, mockTx } =
  vi.hoisted(() => {
    const mockTxDelete = vi.fn();
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
      mockDbDelete: vi.fn(),
      mockTxDelete,
      mockTxUpdate,
      mockTxSelect,
      mockTx: {
        delete: mockTxDelete,
        insert: vi.fn(),
        update: mockTxUpdate,
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
    delete: mockDbDelete,
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

import {
  deleteMealAction,
  updateMealAction,
} from '@/lib/actions/meals/mutate-meal';
import {
  LOGGED_AT,
  MOCK_USER as mockUser,
  UUID_1,
  UUID_2,
  UUID_MEAL,
} from './meal-doubles';

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

describe('updateMealAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Each `tx.select()` resolves through .from().where() — the meal lookup adds
  // .limit(), the item lookup awaits .where() directly. Queue per call.
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
  // The savedMeal rebuild loads the meal's share row last (from→where→limit).
  function queueShareLookup(rows: unknown[]) {
    mockTxSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    });
  }

  function mealRow(overrides: Record<string, unknown> = {}) {
    return {
      id: UUID_MEAL,
      userId: mockUser.id,
      rawInput: 'Phở bò',
      mealSlot: 'lunch',
      confidenceOverall: 'high',
      loggedAt: LOGGED_AT,
      entryMode: 'precise',
      alcoholG: null,
      portionFactor: 1,
      caloriesKcal: 520,
      proteinG: 31,
      carbohydrateG: 60,
      fatG: 14,
      ...overrides,
    };
  }
  function itemRow(overrides: Record<string, unknown> = {}) {
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

  function captureUpdate(captured: Record<string, unknown>[]) {
    return {
      set: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        captured.push(vals);
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    };
  }

  it('rejects a meal that belongs to another user (userId-scoped lookup)', async () => {
    // Defense-in-depth tenant isolation: the meal SELECT is scoped to the
    // authenticated user, so another user's meal returns no row and the edit
    // is refused — never reaching any item update/delete. (Drizzle bypasses
    // RLS; this WHERE userId is the only thing preventing a cross-tenant edit.)
    queueMealLookup([]); // scoped lookup finds nothing for this user

    await expect(
      updateMealAction({
        mealId: UUID_MEAL,
        edits: [{ id: UUID_1, newGrams: 400 }],
      })
    ).rejects.toThrow('không thuộc về bạn');

    // Critically: no item read, update, or delete was attempted.
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxDelete).not.toHaveBeenCalled();
  });

  it('scales the edited item and recomputes meal totals', async () => {
    queueMealLookup([mealRow()]);
    queueItemLookup([
      itemRow(),
      itemRow({
        id: UUID_2,
        ingredientName: 'Thịt bò',
        estimatedGrams: 100,
        caloriesKcal: 220,
        proteinG: 26,
        carbohydrateG: 0,
        fatG: 12,
      }),
    ]);
    queueShareLookup([]);

    const itemUpdates: Record<string, unknown>[] = [];
    const mealUpdates: Record<string, unknown>[] = [];
    let updateCall = 0;
    mockTxUpdate.mockImplementation(() => {
      // First update(s) = item rows, final = the meals total row.
      updateCall += 1;
      return updateCall <= 1
        ? captureUpdate(itemUpdates)
        : captureUpdate(mealUpdates);
    });

    const result = await updateMealAction({
      mealId: UUID_MEAL,
      edits: [{ id: UUID_1, newGrams: 400 }], // double the 200g bánh phở
    });

    // Edited row scaled 2x.
    expect(itemUpdates[0]?.estimatedGrams).toBe(400);
    expect(itemUpdates[0]?.caloriesKcal).toBe(600);
    // Meal totals = scaled bánh phở (600) + untouched thịt bò (220).
    expect(mealUpdates[0]?.caloriesKcal).toBe(820);
    expect(result.meal.nutrition.caloriesKcal).toBe(820);
    expect(result.meal.mealItemGroups[0]?.ingredients).toHaveLength(2);
  });

  it('removes a row and recomputes from what remains', async () => {
    queueMealLookup([mealRow()]);
    queueItemLookup([
      itemRow(),
      itemRow({
        id: UUID_2,
        ingredientName: 'Thịt bò',
        estimatedGrams: 100,
        caloriesKcal: 220,
        proteinG: 26,
        carbohydrateG: 0,
        fatG: 12,
      }),
    ]);
    queueShareLookup([]);

    const mealUpdates: Record<string, unknown>[] = [];
    mockTxUpdate.mockImplementation(() => captureUpdate(mealUpdates));
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    mockTxDelete.mockReturnValue({ where: deleteWhere });

    const result = await updateMealAction({
      mealId: UUID_MEAL,
      removeIds: [UUID_2],
    });

    expect(mockTxDelete).toHaveBeenCalledTimes(1);
    // Only the bánh phở (300) survives.
    expect(mealUpdates[0]?.caloriesKcal).toBe(300);
    expect(result.meal.mealItemGroups[0]?.ingredients).toHaveLength(1);
    expect(result.meal.mealItemGroups[0]?.ingredients[0]?.id).toBe(UUID_1);
  });

  it('refuses to remove the last remaining item', async () => {
    queueMealLookup([mealRow()]);
    queueItemLookup([itemRow()]);

    await expect(
      updateMealAction({ mealId: UUID_MEAL, removeIds: [UUID_1] })
    ).rejects.toThrow('ít nhất một món');
    expect(mockTxDelete).not.toHaveBeenCalled();
  });

  it('refuses to edit a cheat meal through this path', async () => {
    queueMealLookup([mealRow({ entryMode: 'cheat' })]);

    await expect(
      updateMealAction({
        mealId: UUID_MEAL,
        edits: [{ id: UUID_1, newGrams: 400 }],
      })
    ).rejects.toThrow('bữa xả');
  });

  it('scales the meal-level alcohol by the change in total mass', async () => {
    // Alcohol lives on the meal, not the rows, so it tracks the total-mass
    // ratio: halving the only item's grams halves the alcohol.
    queueMealLookup([mealRow({ alcoholG: 40 })]);
    queueItemLookup([itemRow()]); // single 200g item
    queueShareLookup([]);

    const itemUpdates: Record<string, unknown>[] = [];
    const mealUpdates: Record<string, unknown>[] = [];
    let updateCall = 0;
    mockTxUpdate.mockImplementation(() => {
      updateCall += 1;
      return updateCall <= 1
        ? captureUpdate(itemUpdates)
        : captureUpdate(mealUpdates);
    });

    const result = await updateMealAction({
      mealId: UUID_MEAL,
      edits: [{ id: UUID_1, newGrams: 100 }], // 200g → 100g, ratio 0.5
    });

    expect(mealUpdates[0]?.alcoholG).toBe(20);
    expect(result.meal.alcoholG).toBe(20);
  });

  it('leaves a null alcohol value null after an edit', async () => {
    queueMealLookup([mealRow({ alcoholG: null })]);
    queueItemLookup([itemRow()]);
    queueShareLookup([]);

    const mealUpdates: Record<string, unknown>[] = [];
    let updateCall = 0;
    mockTxUpdate.mockImplementation(() => {
      updateCall += 1;
      return updateCall <= 1 ? captureUpdate([]) : captureUpdate(mealUpdates);
    });

    const result = await updateMealAction({
      mealId: UUID_MEAL,
      edits: [{ id: UUID_1, newGrams: 100 }],
    });

    expect(mealUpdates[0]?.alcoholG).toBeNull();
    expect(result.meal.alcoholG).toBeNull();
  });

  it('preserves the meal share state across an edit', async () => {
    // Editing amounts must not reset a shared meal to private in the reconciled
    // card — the existing share row is carried through.
    queueMealLookup([mealRow()]);
    queueItemLookup([itemRow()]);
    queueShareLookup([{ id: UUID_2, visibility: 'circle' }]);

    mockTxUpdate.mockImplementation(() => captureUpdate([]));

    const result = await updateMealAction({
      mealId: UUID_MEAL,
      edits: [{ id: UUID_1, newGrams: 100 }],
    });

    expect(result.meal.share).toEqual({
      shareId: UUID_2,
      visibility: 'circle',
    });
  });

  it('rejects an invalid mealId', async () => {
    await expect(updateMealAction({ mealId: 'bad' })).rejects.toThrow();
  });
});
