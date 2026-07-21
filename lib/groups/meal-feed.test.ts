import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbSelect } = vi.hoisted(() => ({ mockDbSelect: vi.fn() }));

vi.mock('@/lib/db', () => ({ db: { select: mockDbSelect } }));

vi.mock('@/lib/db/schema', () => ({
  mealShares: {
    id: 'ms.id',
    mealId: 'ms.mealId',
    actorId: 'ms.actorId',
    visibility: 'ms.visibility',
    sharedAt: 'ms.sharedAt',
  },
  meals: {
    id: 'm.id',
    userId: 'm.userId',
    rawInput: 'm.rawInput',
    caloriesKcal: 'm.caloriesKcal',
    proteinG: 'm.proteinG',
    carbohydrateG: 'm.carbohydrateG',
    fatG: 'm.fatG',
  },
  publicProfiles: {
    userId: 'pp.userId',
    handle: 'pp.handle',
    displayName: 'pp.displayName',
    avatarSeed: 'pp.avatarSeed',
    avatarUrl: 'pp.avatarUrl',
    avatarPath: 'pp.avatarPath',
  },
  friendships: {
    id: 'f.id',
    userLow: 'f.userLow',
    userHigh: 'f.userHigh',
    status: 'f.status',
  },
}));

import { decodeSharedMealCursor } from '@/lib/groups/feed/cursor';
import { sharedMealsBefore, toSharedMealEntry } from '@/lib/groups/meal-feed';

const USER_A = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function sharedMeal(index: number, sharedAt: Date) {
  return {
    friendUserId: USER_A,
    mealId: `meal-${index}`,
    shareId: `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
    rawInput: `meal ${index}`,
    caloriesKcal: 500,
    proteinG: 20,
    carbohydrateG: 50,
    fatG: 15,
    portionFactor: 1,
    sharedAt,
    // Real-time log: eaten when shared (not backfilled).
    loggedAt: sharedAt,
    sharedAtText: sharedAt.toISOString().replace('Z', '123+00'),
    handle: 'me',
    displayName: null,
    avatarSeed: 'me',
    avatarUrl: null,
    avatarPath: null,
  };
}

// db.select().from().innerJoin().innerJoin().where().orderBy().limit()
function sharedMealsQuery(rows: unknown[]) {
  const query = {
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  query.innerJoin.mockReturnValue(query);
  query.leftJoin.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  mockDbSelect.mockReturnValueOnce({ from: vi.fn().mockReturnValue(query) });
}

describe('sharedMealsBefore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty page when the authorized query has no rows', async () => {
    sharedMealsQuery([]);
    const page = await sharedMealsBefore(USER_A, null);

    expect(page).toEqual({ rows: [], nextCursor: null });
    expect(mockDbSelect).toHaveBeenCalledTimes(1);
  });

  it('has a null nextCursor when fewer rows than the limit are returned', async () => {
    const rows = [sharedMeal(1, new Date('2026-01-03T00:00:00Z'))];
    sharedMealsQuery(rows);

    const page = await sharedMealsBefore(USER_A, null, undefined, 20);

    expect(page.rows).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it('slices to `limit` and sets nextCursor to the oldest row when more history exists', async () => {
    // 3 rows returned for a limit of 2 — the +1 over-fetch signals "more exists".
    const rows = [
      sharedMeal(3, new Date('2026-01-03T00:00:00Z')),
      sharedMeal(2, new Date('2026-01-02T00:00:00Z')),
      sharedMeal(1, new Date('2026-01-01T00:00:00Z')),
    ];
    sharedMealsQuery(rows);

    const page = await sharedMealsBefore(USER_A, null, undefined, 2);

    expect(page.rows).toHaveLength(2);
    expect(page.rows.map((r) => r.mealId)).toEqual(['meal-3', 'meal-2']);
    // The cursor is the oldest row IN THE PAGE, not the dropped extra row.
    expect(decodeSharedMealCursor(page.nextCursor ?? undefined)).toEqual({
      ts: rows[1].sharedAtText,
      id: rows[1].shareId,
    });
  });

  it('does not collapse multiple shares from the same user (unlike mostRecentSharedMealsToday)', async () => {
    const rows = [
      sharedMeal(2, new Date('2026-01-01T18:00:00Z')), // dinner
      sharedMeal(1, new Date('2026-01-01T08:00:00Z')), // breakfast
    ];
    sharedMealsQuery(rows);

    const page = await sharedMealsBefore(USER_A, null, undefined, 20);

    expect(page.rows).toHaveLength(2);
  });
});

describe('toSharedMealEntry', () => {
  it('tags isSelf based on the actor id', () => {
    const row = sharedMeal(1, new Date('2026-01-01T00:00:00Z'));

    expect(toSharedMealEntry(row, USER_A).isSelf).toBe(true);
    expect(toSharedMealEntry(row, 'someone-else').isSelf).toBe(false);
  });

  it('is not backfilled when logged ≈ shared (real-time log)', () => {
    const sharedAt = new Date('2026-01-01T12:00:00Z');
    const row = { ...sharedMeal(1, sharedAt), loggedAt: sharedAt };

    expect(toSharedMealEntry(row, USER_A).meal.isBackfilled).toBe(false);
  });

  it('is not backfilled for a same-day analyze→confirm gap under the threshold', () => {
    const sharedAt = new Date('2026-01-01T12:00:00Z');
    // Analyzed ~2h earlier, confirmed now — same-day, still shows time.
    const row = {
      ...sharedMeal(1, sharedAt),
      loggedAt: new Date('2026-01-01T10:00:00Z'),
    };

    expect(toSharedMealEntry(row, USER_A).meal.isBackfilled).toBe(false);
  });

  it('is backfilled when logged for a past date (≥ ~24h before shared)', () => {
    const sharedAt = new Date('2026-01-02T12:00:00Z');
    // Logged for yesterday at the same time-of-day it was analyzed.
    const row = {
      ...sharedMeal(1, sharedAt),
      loggedAt: new Date('2026-01-01T12:00:00Z'),
    };

    expect(toSharedMealEntry(row, USER_A).meal.isBackfilled).toBe(true);
  });
});
