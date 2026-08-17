import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockUser, mockTxInsert, mockDbSelect, mockTx } = vi.hoisted(() => {
  const mockTxInsert = vi.fn();
  const mockDbSelect = vi.fn();
  const mockTx = {
    insert: mockTxInsert,
    select: vi.fn(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(
          // Thenable + .for('update') — the share helper locks the row.
          Object.assign(Promise.resolve([{ autoShareToCircle: true }]), {
            for: vi.fn().mockResolvedValue([{ autoShareToCircle: true }]),
          })
        ),
      }),
    })),
  };
  return {
    mockUser: { id: 'user-123', email: 'test@example.com' },
    mockTxInsert,
    mockDbSelect,
    mockTx,
  };
});

vi.mock('@/lib/infra/auth/session', () => ({
  requireAuthAndProfile: vi.fn().mockResolvedValue({
    user: mockUser,
    profile: { goal: 'maintaining', aggression: null },
  }),
}));

vi.mock('@/lib/infra/db', () => ({
  db: {
    transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx)
    ),
    select: mockDbSelect,
  },
}));

vi.mock('@/lib/infra/db/schema', () => ({
  meals: { id: 'meals.id' },
  mealItems: { mealId: 'mealItems.mealId' },
  mealShares: {
    mealId: 'mealShares.mealId',
    id: 'mealShares.id',
    visibility: 'mealShares.visibility',
  },
  userProfiles: {
    userId: 'userProfiles.userId',
    autoShareToCircle: 'userProfiles.autoShareToCircle',
  },
  vietnameseFoodComposition: { id: 'vfc.id' },
}));

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import { saveManualMealAction } from '@/lib/actions/logging/manual-meals';

const UUID_MEAL = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';

// Composition rows as drizzle returns them: camelCase keys, numeric columns as
// strings (declared without mode:'number').
const riceRow = {
  id: 'fct-rice',
  namePrimary: 'Cơm trắng',
  nameEn: 'White rice',
  state: 'cooked',
  caloriesKcal: '130',
  proteinG: '2.7',
  carbohydrateG: '28',
  fatG: '0.3',
  fiberG: null,
  sodiumMg: '1',
};

const chickenRow = {
  id: 'fct-chicken',
  namePrimary: 'Thịt gà ta',
  nameEn: 'Chicken meat',
  state: 'raw',
  caloriesKcal: '199',
  proteinG: '20.3',
  carbohydrateG: '0',
  fatG: '13.1',
  fiberG: null,
  sodiumMg: null,
};

function mockCompositionRows(rows: Record<string, unknown>[]) {
  mockDbSelect.mockReturnValue({
    from: () => ({ where: () => Promise.resolve(rows) }),
  });
}

function mockInserts(mealId: string) {
  const insertedValues: unknown[] = [];
  mockTxInsert.mockImplementation((table: { id?: string }) => {
    // The default share-to-circle insert on mealShares gets its own
    // `.values().onConflictDoNothing().returning()` chain so it never lands in
    // `insertedValues` — keeping the meal/item index assertions stable.
    if (table?.id === 'mealShares.id') {
      return {
        values: () => ({
          onConflictDoNothing: () => ({
            returning: () =>
              Promise.resolve([{ id: 'share-1', visibility: 'circle' }]),
          }),
        }),
      };
    }
    return {
      values: (values: unknown) => {
        insertedValues.push(values);
        return { returning: () => Promise.resolve([{ id: mealId }]) };
      },
    };
  });
  return insertedValues;
}

const baseInput = {
  mealId: UUID_MEAL,
  loggedDate: '2026-06-12',
  timezoneOffset: -420, // UTC+7
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saveManualMealAction', () => {
  it('scales per-100g nutrition exactly and preserves null micros', async () => {
    mockCompositionRows([riceRow]);
    const inserted = mockInserts(UUID_MEAL);

    const result = await saveManualMealAction({
      ...baseInput,
      items: [{ foodCompositionId: 'fct-rice', grams: 150 }],
    });

    const ingredient = result.meal.mealItemGroups[0].ingredients[0];
    expect(ingredient.nutrition.caloriesKcal).toBeCloseTo(195); // 130 × 1.5
    expect(ingredient.nutrition.proteinG).toBeCloseTo(4.05);
    expect(ingredient.nutrition.carbohydrateG).toBeCloseTo(42);
    expect(ingredient.nutrition.fatG).toBeCloseTo(0.45);
    expect(ingredient.nutrition.sodiumMg).toBeCloseTo(1.5);
    // Unknown stays unknown — never a false zero.
    expect(ingredient.nutrition.fiberG).toBeNull();

    const mealRow = inserted[0] as Record<string, unknown>;
    expect(mealRow.caloriesKcal).toBeCloseTo(195);
    expect(mealRow.fiberG).toBeNull();
  });

  it('sums nutrition across items into the meal total', async () => {
    mockCompositionRows([riceRow, chickenRow]);
    mockInserts(UUID_MEAL);

    const result = await saveManualMealAction({
      ...baseInput,
      items: [
        { foodCompositionId: 'fct-rice', grams: 100 },
        { foodCompositionId: 'fct-chicken', grams: 200 },
      ],
    });

    expect(result.meal.nutrition.caloriesKcal).toBeCloseTo(130 + 398);
    expect(result.meal.nutrition.proteinG).toBeCloseTo(2.7 + 40.6);
    // Sodium known only for rice — sums the known value.
    expect(result.meal.nutrition.sodiumMg).toBeCloseTo(1);
    expect(result.meal.nutrition.fiberG).toBeNull();
  });

  it('persists meal and meal_items rows with manual provenance markers', async () => {
    mockCompositionRows([riceRow, chickenRow]);
    const inserted = mockInserts(UUID_MEAL);

    await saveManualMealAction({
      ...baseInput,
      mealSlot: 'lunch',
      items: [
        { foodCompositionId: 'fct-rice', grams: 150 },
        { foodCompositionId: 'fct-chicken', grams: 100 },
      ],
    });

    const mealRow = inserted[0] as Record<string, unknown>;
    expect(mealRow).toMatchObject({
      id: UUID_MEAL,
      userId: mockUser.id,
      entryMode: 'precise',
      confidenceOverall: 'high',
      mealSlot: 'lunch',
      rawInput: '150g Cơm trắng, 100g Thịt gà ta',
    });

    const itemRows = inserted[1] as Record<string, unknown>[];
    expect(itemRows).toHaveLength(2);
    expect(itemRows[0]).toMatchObject({
      mealId: UUID_MEAL,
      ingredientName: 'Cơm trắng',
      mealItemName: 'Cơm trắng',
      mealItemOrder: 0,
      foodCompositionId: 'fct-rice',
      estimatedGrams: 150,
      userFacingUnit: 'g',
      cookingMethod: null,
      matchConfidence: 1,
    });
    expect(itemRows[1]).toMatchObject({
      mealItemOrder: 1,
      foodCompositionId: 'fct-chicken',
      estimatedGrams: 100,
    });
    // Inserted item ids match the ids returned in the payload.
    const returnedIds = (
      await saveManualMealAction({
        ...baseInput,
        items: [{ foodCompositionId: 'fct-rice', grams: 150 }],
      })
    ).meal.mealItemGroups.map((g) => g.ingredients[0].id);
    expect(returnedIds.every((id) => typeof id === 'string')).toBe(true);
  });

  it('rejects when an ingredient id does not exist', async () => {
    mockCompositionRows([riceRow]);
    mockInserts(UUID_MEAL);

    await expect(
      saveManualMealAction({
        ...baseInput,
        items: [
          { foodCompositionId: 'fct-rice', grams: 100 },
          { foodCompositionId: 'fct-ghost', grams: 100 },
        ],
      })
    ).rejects.toThrow();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('returns the PersistedMeal shape the day loader produces', async () => {
    mockCompositionRows([riceRow]);
    mockInserts(UUID_MEAL);

    const result = await saveManualMealAction({
      ...baseInput,
      items: [{ foodCompositionId: 'fct-rice', grams: 150 }],
    });

    expect(result.mealId).toBe(UUID_MEAL);
    expect(result.meal).toMatchObject({
      id: UUID_MEAL,
      entryMode: 'precise',
      alcoholG: null,
      cheatSliders: null,
      // Shared to circle by default, like every other meal-creation path.
      share: { shareId: 'share-1', visibility: 'circle' },
      confidenceOverall: 'high',
    });
    // One flat group per ingredient; group nutrition equals its single
    // ingredient's nutrition (the builder sums displayed nutrition).
    expect(result.meal.mealItemGroups).toHaveLength(1);
    const group = result.meal.mealItemGroups[0];
    expect(group.name).toBe('Cơm trắng');
    expect(group.nutrition.caloriesKcal).toBeCloseTo(
      group.ingredients[0].nutrition.caloriesKcal ?? Number.NaN
    );
    // loggedAt lands inside the local day that was sent (UTC+7).
    const loggedAtMs = Date.parse(result.meal.loggedAt);
    const localMs = loggedAtMs - baseInput.timezoneOffset * 60_000;
    expect(new Date(localMs).toISOString().slice(0, 10)).toBe(
      baseInput.loggedDate
    );
  });

  it('does not share a manual meal when the profile opts out', async () => {
    mockCompositionRows([riceRow]);
    mockInserts(UUID_MEAL);
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(
          // Thenable + .for('update') — the share helper locks the row.
          Object.assign(Promise.resolve([{ autoShareToCircle: false }]), {
            for: vi.fn().mockResolvedValue([{ autoShareToCircle: false }]),
          })
        ),
      }),
    });

    const result = await saveManualMealAction({
      ...baseInput,
      items: [{ foodCompositionId: 'fct-rice', grams: 150 }],
    });

    const insertedIntoMealShares = mockTxInsert.mock.calls.some(
      ([table]) => table?.id === 'mealShares.id'
    );
    expect(insertedIntoMealShares).toBe(false);
    expect(result.meal.share).toBeNull();
  });

  it('rejects invalid input (no items, non-positive grams)', async () => {
    await expect(
      saveManualMealAction({ ...baseInput, items: [] })
    ).rejects.toThrow();
    await expect(
      saveManualMealAction({
        ...baseInput,
        items: [{ foodCompositionId: 'fct-rice', grams: 0 }],
      })
    ).rejects.toThrow();
    expect(mockDbSelect).not.toHaveBeenCalled();
  });
});
