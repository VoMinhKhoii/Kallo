import { beforeEach, describe, expect, it, vi } from 'vitest';

// The copy seam shared by accept-a-share, duplicate, and "log this too". Its
// two callers disagree about what a copy IS — a share is the same eating event
// seen from another diary, a re-log is a new one happening now — and that
// disagreement is expressed by one optional `mealSlot` option. This suite pins
// both branches, because getting it wrong is silent: the meal still saves, it
// just lands under the wrong heading in someone's day.

const { mockInsertDefaultCircleShare } = vi.hoisted(() => ({
  mockInsertDefaultCircleShare: vi.fn(
    async (): Promise<{ shareId: string; visibility: string } | null> => ({
      shareId: 'share-1',
      visibility: 'circle',
    })
  ),
}));
vi.mock('@/lib/actions/meals/insert-default-share', () => ({
  insertDefaultCircleShare: mockInsertDefaultCircleShare,
}));

vi.mock('@/lib/infra/db/schema', () => ({
  meals: { id: 'meals.id' },
  mealItems: { id: 'mealItems.id' },
}));

import { copyMealVerbatim } from '@/lib/actions/meals/copy-meal-verbatim';

const NEW_MEAL_ID = 'f5dd0044-e150-4dd3-b012-b00e01835f66';
const SOURCE_MEAL_ID = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const USER_ID = '9d1f2c44-7b3e-4a55-9c22-1aa2bb334455';

/** 00:30Z. Whatever timezone the test process runs in, this is far enough from
 *  the source's own slot that an inferred slot cannot accidentally match the
 *  copied one — see the `expect(...).not.toBe` in the inference case. */
const SOURCE_LOGGED_AT = new Date('2026-04-05T00:30:00.000Z');

function sourceMeal(overrides: Record<string, unknown> = {}) {
  return {
    id: SOURCE_MEAL_ID,
    userId: 'someone-else',
    rawInput: 'Bún chả',
    mealSlot: 'breakfast',
    confidenceOverall: 'high',
    loggedAt: SOURCE_LOGGED_AT,
    entryMode: 'precise',
    alcoholG: null,
    portionFactor: 1,
    caloriesKcal: 600,
    proteinG: 30,
    carbohydrateG: 70,
    fatG: 20,
    ...overrides,
  };
}

function sourceItem() {
  return {
    id: 'd3bbef22-cf3e-4bb1-9e90-9eecef613d44',
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

/** Captures what the copy would have written, and hands `meals` an id back. */
function fakeTx() {
  const captured: { meal?: Record<string, unknown> } = {};
  const tx = {
    insert: vi.fn((table: { id?: string }) => ({
      values: vi.fn((vals: unknown) => {
        if (table?.id === 'meals.id') {
          captured.meal = vals as Record<string, unknown>;
          return {
            returning: vi.fn().mockResolvedValue([{ id: NEW_MEAL_ID }]),
          };
        }
        return undefined;
      }),
    })),
  };
  // biome-ignore lint/suspicious/noExplicitAny: a hand-rolled transaction double
  return { tx: tx as any, captured };
}

describe('copyMealVerbatim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carries an explicit slot through to the row and the returned card', async () => {
    const { tx, captured } = fakeTx();

    const result = await copyMealVerbatim(tx, sourceMeal(), [sourceItem()], {
      userId: USER_ID,
      newMealId: NEW_MEAL_ID,
      loggedAt: SOURCE_LOGGED_AT,
      mealSlot: 'breakfast',
      factor: 1,
    });

    expect(captured.meal?.mealSlot).toBe('breakfast');
    expect(captured.meal?.loggedAt).toEqual(SOURCE_LOGGED_AT);
    // Row and card must agree, or the feed reconciles an optimistic entry onto
    // a meal that sits somewhere else in the day.
    expect(result.meal.mealSlot).toBe('breakfast');
    expect(result.meal.loggedAt).toBe(SOURCE_LOGGED_AT.toISOString());
  });

  it('infers the slot from loggedAt when none is given — the re-log case', async () => {
    const { tx, captured } = fakeTx();
    // 20:00 local, whatever the process timezone: always the "dinner" bucket.
    const tonight = new Date();
    tonight.setHours(20, 0, 0, 0);

    await copyMealVerbatim(tx, sourceMeal(), [sourceItem()], {
      userId: USER_ID,
      loggedAt: tonight,
      factor: 1,
    });

    expect(captured.meal?.mealSlot).toBe('dinner');
    // The point of the assertion: inference must NOT quietly fall back to the
    // source's slot, or duplicate-meal would stop behaving like a new meal.
    expect(captured.meal?.mealSlot).not.toBe('breakfast');
  });

  it('treats a null slot as "infer" — legacy rows carry null meal_slot', async () => {
    const { tx, captured } = fakeTx();
    const tonight = new Date();
    tonight.setHours(20, 0, 0, 0);

    await copyMealVerbatim(tx, sourceMeal({ mealSlot: null }), [sourceItem()], {
      userId: USER_ID,
      loggedAt: tonight,
      mealSlot: null,
      factor: 1,
    });

    expect(captured.meal?.mealSlot).toBe('dinner');
  });
});
