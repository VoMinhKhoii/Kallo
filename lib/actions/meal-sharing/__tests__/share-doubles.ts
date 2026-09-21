// Shared doubles for the directed meal-share suites (share-with-friends and
// invite-response). Both drive the same transaction handle through the same
// schema stand-in, so the row builders and the tx.select/tx.update queues live
// here rather than being copied per file.

import type { Mock } from 'vitest';
import { vi } from 'vitest';

export const MOCK_USER = {
  id: '9d1f2c44-7b3e-4a55-9c22-1aa2bb334455',
  email: 'me@example.com',
};

/** The premium gates key their trial window off the profile's creation date. */
export const PROFILE_CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

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
    copyFactor: 'mealShareInvites.copyFactor',
    acceptedMealId: 'mealShareInvites.acceptedMealId',
  },
  friendships: {
    id: 'friendships.id',
    userLow: 'friendships.userLow',
    userHigh: 'friendships.userHigh',
    status: 'friendships.status',
  },
  pendingAnalyses: {
    id: 'pendingAnalyses.id',
    userId: 'pendingAnalyses.userId',
  },
  publicProfiles: { userId: 'publicProfiles.userId' },
  userProfiles: {
    userId: 'userProfiles.userId',
    autoShareToCircle: 'userProfiles.autoShareToCircle',
  },
};

/**
 * Every WHERE predicate the queued selects/updates were handed, serialized.
 *
 * Without this the doubles accept any predicate at all, so deleting the
 * actor-scoping from a query — `toUserId = me`, `meals.userId = sender` —
 * still passed every test in these suites. Authorization here is entirely a
 * matter of predicates (Drizzle bypasses RLS), so the predicates have to be
 * something a test can actually look at.
 */
export const capturedPredicates: string[] = [];

function recordPredicate(predicate: unknown): void {
  capturedPredicates.push(JSON.stringify(predicate) ?? '');
}

/** Queue helpers bound to one suite's tx.select / tx.update mocks. */
export function txQueues(mockTxSelect: Mock, mockTxUpdate: Mock) {
  // select ending in .limit(1) — meal / friendship / source / share lookups.
  // The resolved value also carries .for() so the row-locked source lookup
  // (`.limit(1).for('update')`) consumes the same queue slot.
  function queueLimitSelect(rows: unknown[]) {
    mockTxSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation((predicate: unknown) => {
          recordPredicate(predicate);
          return {
            limit: vi.fn().mockReturnValue(
              Object.assign(Promise.resolve(rows), {
                for: vi.fn().mockResolvedValue(rows),
              })
            ),
          };
        }),
      }),
    });
  }

  // select awaited at .where() — friendship / item lookups.
  function queueWhereSelect(rows: unknown[]) {
    mockTxSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation((predicate: unknown) => {
          recordPredicate(predicate);
          return Promise.resolve(rows);
        }),
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
        return {
          where: (predicate: unknown) => {
            recordPredicate(predicate);
            return where;
          },
        };
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

/**
 * A cheat occasion: zero item rows, nutrition on the meal row itself, and the
 * slider spec + the levels the logger chose in `cheatSliders`. Shares as a COPY
 * only, and taking that copy reopens these sliders rather than duplicating the
 * numbers — see stage-cheat-copy.ts.
 */
export function cheatSourceMeal(overrides: Record<string, unknown> = {}) {
  return sourceMeal({
    rawInput: 'Buffet nướng',
    entryMode: 'cheat',
    mealSlot: 'dinner',
    caloriesKcal: 1400,
    cheatSliders: {
      spec: {
        sliders: [
          {
            key: 'protein',
            label: 'Đạm',
            defaultLevel: 4,
            anchors: [
              { level: 0, label: 'ít', proteinG: 0 },
              { level: 10, label: 'nhiều', proteinG: 80 },
            ],
          },
        ],
        mealSlot: 'dinner',
        confidence: 'medium',
      },
      // The sender ended up at 8, not the model's default of 4 — the seam the
      // staging path has to carry across into MY card's starting position.
      levels: { protein: 8 },
    },
    ...overrides,
  });
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
/** What `routeInserts` writes back: the values a statement was handed, and for
 *  the invite upsert its conflict clause too. */
export type InsertCaptures = Record<
  string,
  { vals: unknown; conflict?: unknown }
>;

export function routeInserts(
  captured: InsertCaptures,
  opts: {
    /**
     * What the invite upsert's RETURNING yields, given the rows it was handed.
     * Defaults to all of them. Pass `() => []` to model Postgres skipping every
     * row via `setWhere` — the already-accepted case, where the sender offered
     * nothing even though they named recipients.
     */
    invitesWritten?: (rows: { toUserId: string }[]) => unknown[];
  } = {}
) {
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
          // RETURNING yields the rows the upsert actually wrote — the set the
          // producer notifies. Accepted invites are filtered out by setWhere
          // in Postgres, so a test models that by omitting them here.
          const rows = vals as { toUserId: string }[];
          const written = opts.invitesWritten
            ? opts.invitesWritten(rows)
            : rows.map((row, index) => ({
                id: `invite-${index}`,
                toUserId: row.toUserId,
              }));
          return {
            onConflictDoUpdate: vi.fn((clause: unknown) => {
              // The upsert's `setWhere` decides whether a re-share reaches a
              // recipient at all, so a test has to be able to look at it.
              captured.invites = { vals, conflict: clause };
              return { returning: vi.fn().mockResolvedValue(written) };
            }),
          };
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
