// Shared doubles for the directed meal-share suites (share-with-friends and
// invite-response). Both drive the same transaction handle through the same
// schema stand-in, so the row builders and the tx.select/tx.update queues live
// here rather than being copied per file.

import type { Mock } from 'vitest';
import { vi } from 'vitest';

export const MOCK_USER = { id: 'user-123', email: 'me@example.com' };

export const UUID_MEAL = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
export const UUID_FRIEND = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
export const UUID_FRIEND_2 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
export const UUID_ITEM = 'd3bbef22-cf3e-4bb1-9e90-9eecef613d44';
export const UUID_INVITE = 'e4ccff33-d04f-4cc2-af01-affdf0724e55';
export const UUID_NEW = 'f5dd0044-e150-4dd3-b012-b00e01835f66';
export const LOGGED_AT = new Date('2026-04-05T17:30:00.000Z');

/** Column-name stand-in for `@/lib/infra/db/schema` — routeInserts dispatches on it. */
export const schema = {
  meals: { id: 'meals.id', userId: 'meals.userId' },
  mealItems: { id: 'mealItems.id', mealId: 'mealItems.mealId' },
  mealShares: {
    id: 'mealShares.id',
    mealId: 'mealShares.mealId',
    visibility: 'mealShares.visibility',
  },
  mealShareInvites: {
    id: 'mealShareInvites.id',
    sourceMealId: 'mealShareInvites.sourceMealId',
    toUserId: 'mealShareInvites.toUserId',
    fromUserId: 'mealShareInvites.fromUserId',
    status: 'mealShareInvites.status',
  },
  friendships: {
    id: 'friendships.id',
    userLow: 'friendships.userLow',
    userHigh: 'friendships.userHigh',
    status: 'friendships.status',
  },
  publicProfiles: { userId: 'publicProfiles.userId' },
  userProfiles: {
    userId: 'userProfiles.userId',
    autoShareToCircle: 'userProfiles.autoShareToCircle',
  },
};

/** Queue helpers bound to one suite's tx.select / tx.update mocks. */
export function txQueues(mockTxSelect: Mock, mockTxUpdate: Mock) {
  // select ending in .limit(1) — meal / friendship / source / share lookups.
  // The resolved value also carries .for() so the row-locked source lookup
  // (`.limit(1).for('update')`) consumes the same queue slot.
  function queueLimitSelect(rows: unknown[]) {
    mockTxSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue(
            Object.assign(Promise.resolve(rows), {
              for: vi.fn().mockResolvedValue(rows),
            })
          ),
        }),
      }),
    });
  }

  // select awaited at .where() — friendship / item lookups.
  function queueWhereSelect(rows: unknown[]) {
    mockTxSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    });
  }

  // One tx.update implementation handling both shapes: `.set().where()`
  // (awaited) and `.set().where().returning()` (the atomic claim). Captured
  // set-values land in `captures`; `.returning()` yields `returning`.
  function installUpdate(opts: {
    returning?: unknown[];
    captures?: Record<string, unknown>[];
  }) {
    mockTxUpdate.mockImplementation(() => ({
      set: (vals: Record<string, unknown>) => {
        opts.captures?.push(vals);
        const where = Object.assign(Promise.resolve(undefined), {
          returning: () => Promise.resolve(opts.returning ?? []),
        });
        return { where: () => where };
      },
    }));
  }

  return { queueLimitSelect, queueWhereSelect, installUpdate };
}

export function sourceMeal(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID_MEAL,
    userId: MOCK_USER.id,
    rawInput: 'Trà sữa',
    mealSlot: 'snack',
    confidenceOverall: 'high',
    loggedAt: LOGGED_AT,
    entryMode: 'precise',
    alcoholG: null,
    portionFactor: 1,
    caloriesKcal: 200,
    proteinG: 4,
    carbohydrateG: 40,
    fatG: 5,
    ...overrides,
  };
}

export function sourceItem(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID_ITEM,
    mealId: UUID_MEAL,
    ingredientName: 'Trà sữa',
    mealItemName: 'Trà sữa',
    mealItemOrder: 0,
    foodCompositionId: 'fc-1',
    estimatedGrams: 400,
    userFacingUnit: '1 ly',
    cookingMethod: null,
    matchConfidence: 0.9,
    caloriesKcal: 200,
    proteinG: 4,
    carbohydrateG: 40,
    fatG: 5,
    ...overrides,
  };
}

export const friendEdge = { userLow: MOCK_USER.id, userHigh: UUID_FRIEND };

// Route tx.insert by table: meals → returning [{id}], mealShares → the default
// circle-share chain, meal_share_invites / mealItems → capture the values.
export function routeInserts(captured: Record<string, { vals: unknown }>) {
  return (table: { id?: string; sourceMealId?: string }) => {
    if (table?.id === 'mealShares.id') {
      return {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValue([{ id: 'share-1', visibility: 'circle' }]),
          }),
        }),
      };
    }
    if (table?.sourceMealId === 'mealShareInvites.sourceMealId') {
      return {
        values: vi.fn().mockImplementation((vals: unknown) => {
          captured.invites = { vals };
          return { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) };
        }),
      };
    }
    // meals or mealItems
    return {
      values: vi.fn().mockImplementation((vals: unknown) => {
        if (table?.id === 'meals.id') {
          captured.meal = { vals };
          return { returning: vi.fn().mockResolvedValue([{ id: UUID_NEW }]) };
        }
        captured.items = { vals };
        return undefined;
      }),
    };
  };
}
