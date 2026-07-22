import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUser, mockCanViewShare, mockTxSelect, mockTxInsert, mockTx } =
  vi.hoisted(() => {
    const mockTxSelect = vi.fn(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ autoShareToCircle: true }]),
      }),
    }));
    const mockTxInsert = vi.fn();
    return {
      mockUser: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
      mockCanViewShare: vi.fn(),
      mockTxSelect,
      mockTxInsert,
      mockTx: { select: mockTxSelect, insert: mockTxInsert },
    };
  });

vi.mock('@/lib/auth', () => ({
  requireAuthAndProfile: vi.fn().mockResolvedValue({
    user: mockUser,
    profile: {},
  }),
}));
vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn((run: (tx: typeof mockTx) => Promise<unknown>) =>
      run(mockTx)
    ),
  },
}));
vi.mock('@/lib/groups/share-visibility', () => ({
  canViewShare: mockCanViewShare,
}));

import { logSharedMealAction } from '@/lib/actions/meal-sharing/log-shared';
import { mealItems, mealShares, meals } from '@/lib/db/schema';

const SHARE_ID = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const SOURCE_MEAL_ID = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const SOURCE_ITEM_ID = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';
const NEW_MEAL_ID = 'e4ccef33-df4f-4cc2-af0f-0ffdf0724e55';

function sourceMeal(overrides: Record<string, unknown> = {}) {
  return {
    id: SOURCE_MEAL_ID,
    userId: 'f5dd0044-e150-4dd3-b012-b00e01835f66',
    rawInput: 'Bún chả',
    mealSlot: 'lunch',
    confidenceOverall: 'high',
    loggedAt: new Date('2026-07-10T05:00:00.000Z'),
    entryMode: 'precise',
    alcoholG: 10,
    portionFactor: 0.5,
    caloriesKcal: 600,
    proteinG: 30,
    carbohydrateG: 70,
    fatG: 20,
    ...overrides,
  };
}

function sourceItem() {
  return {
    id: SOURCE_ITEM_ID,
    mealId: SOURCE_MEAL_ID,
    ingredientName: 'Bún chả',
    mealItemName: 'Bún chả',
    mealItemOrder: 0,
    foodCompositionId: null,
    estimatedGrams: 400,
    userFacingUnit: '1 phần',
    cookingMethod: null,
    matchConfidence: 0.9,
    caloriesKcal: 600,
    proteinG: 30,
    carbohydrateG: 70,
    fatG: 20,
  };
}

function queueSource(rows: unknown[]) {
  const locked = Object.assign(Promise.resolve(rows), {
    for: vi.fn().mockResolvedValue(rows),
  });
  const query = {
    innerJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockReturnValue(locked),
  };
  query.innerJoin.mockReturnValue(query);
  query.where.mockReturnValue(query);
  mockTxSelect.mockReturnValueOnce({
    from: vi.fn().mockReturnValue(query),
  });
}

function queueItems(rows: unknown[]) {
  mockTxSelect.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  });
}

function captureCopies() {
  const captured: {
    meal?: Record<string, unknown>;
    items?: Record<string, unknown>[];
  } = {};
  mockTxInsert.mockImplementation((table: unknown) => {
    if (table === meals) {
      return {
        values: vi.fn((values: Record<string, unknown>) => {
          captured.meal = values;
          return {
            returning: vi.fn().mockResolvedValue([{ id: NEW_MEAL_ID }]),
          };
        }),
      };
    }
    if (table === mealShares) {
      return {
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi
              .fn()
              .mockResolvedValue([{ id: SHARE_ID, visibility: 'circle' }]),
          })),
        })),
      };
    }
    if (table === mealItems) {
      return {
        values: vi.fn((values: Record<string, unknown>[]) => {
          captured.items = values;
          return Promise.resolve(undefined);
        }),
      };
    }
    throw new Error('Unexpected insert table.');
  });
  return captured;
}

function log(factor: 1 | 0.5) {
  return logSharedMealAction({
    shareId: SHARE_ID,
    factor,
    loggedDate: '2026-07-17',
    timezoneOffset: -420,
    newMealId: NEW_MEAL_ID,
  });
}

describe('logSharedMealAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanViewShare.mockResolvedValue(true);
  });

  it('copies an authorized share verbatim at factor 1', async () => {
    queueSource([sourceMeal()]);
    queueItems([sourceItem()]);
    const captured = captureCopies();

    const result = await log(1);

    expect(captured.meal).toMatchObject({
      userId: mockUser.id,
      caloriesKcal: 600,
      alcoholG: 10,
      portionFactor: 0.5,
    });
    expect(captured.items?.[0]).toMatchObject({
      mealId: NEW_MEAL_ID,
      estimatedGrams: 400,
      caloriesKcal: 600,
    });
    expect(result.meal.portionFactor).toBe(0.5);
  });

  it('halves nutrition and multiplies the source portion factor', async () => {
    queueSource([sourceMeal()]);
    queueItems([sourceItem()]);
    const captured = captureCopies();

    const result = await log(0.5);

    expect(captured.meal).toMatchObject({
      caloriesKcal: 300,
      proteinG: 15,
      alcoholG: 5,
      portionFactor: 0.25,
    });
    expect(captured.items?.[0]).toMatchObject({
      estimatedGrams: 200,
      caloriesKcal: 300,
      proteinG: 15,
    });
    expect(result.meal.portionFactor).toBe(0.25);
    expect(result.meal.nutrition.caloriesKcal).toBe(300);
  });

  it('refuses a stranger before reading the source meal', async () => {
    mockCanViewShare.mockResolvedValue(false);

    await expect(log(1)).rejects.toThrow('Không tìm thấy bài chia sẻ.');
    expect(mockTxSelect).not.toHaveBeenCalled();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('refuses a cheat source', async () => {
    queueSource([sourceMeal({ entryMode: 'cheat' })]);

    await expect(log(1)).rejects.toThrow('Không thể ăn theo bữa xả.');
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('refuses an item-less precise source', async () => {
    queueSource([sourceMeal()]);
    queueItems([]);

    await expect(log(1)).rejects.toThrow('không có món để thêm');
    expect(mockTxInsert).not.toHaveBeenCalled();
  });
});
