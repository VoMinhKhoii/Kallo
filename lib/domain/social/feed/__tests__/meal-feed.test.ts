import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbSelect } = vi.hoisted(() => ({ mockDbSelect: vi.fn() }));

vi.mock('@/lib/infra/db/client', () => ({ db: { select: mockDbSelect } }));

// The real schema: the friend-visibility predicate is asserted on the SQL it
// renders, which needs real column objects rather than string stand-ins.

import { decodeSharedMealCursor } from '@/lib/domain/social/feed/cursor';
import {
  mostRecentSharedMealsToday,
  sharedMealsBefore,
  toSharedMealEntry,
} from '@/lib/domain/social/feed/meal-feed';

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
    entryMode: 'precise',
    alcoholG: null,
    cheatSliders: null,
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
  return query;
}

/** Render the WHERE clause a query double received, as Postgres would see it. */
function renderedWhere(where: ReturnType<typeof vi.fn>) {
  return new PgDialect().sqlToQuery(where.mock.calls[0][0] as SQL);
}

// The pre-connection backlog rule (KALLO-03): a friend's share is visible only
// when shared_at >= friendships.accepted_at; the viewer's own shares are not
// bounded. The comparison runs in Postgres, so what can be pinned here is that
// every friend-feed query carries it — and carries it for the right viewer.
const FRIEND_SINCE = '"friendships"."accepted_at" <= "meal_shares"."shared_at"';

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

describe('friend feeds hide shares made before the friendship', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sharedMealsBefore admits the viewer or a friend connected before the share', async () => {
    const query = sharedMealsQuery([]);

    await sharedMealsBefore(USER_A, null);

    const { sql, params } = renderedWhere(query.where);
    expect(sql).toContain('"meal_shares"."actor_id" = $1');
    expect(sql).toContain(FRIEND_SINCE);
    expect(sql).toContain(`"friendships"."status" = 'accepted'`);
    // Every bound id is the viewer's — never an unscoped friendship.
    expect(params.slice(0, 3)).toEqual([USER_A, USER_A, USER_A]);
    // The unbounded left join is gone: authorization lives in the WHERE.
    expect(query.leftJoin).not.toHaveBeenCalled();
  });

  it('mostRecentSharedMealsToday applies the same bound for the viewer', async () => {
    const query = {
      innerJoin: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn().mockResolvedValue([]),
    };
    query.innerJoin.mockReturnValue(query);
    query.where.mockReturnValue(query);
    const selectDistinctOn = vi.fn(() => ({
      from: vi.fn().mockReturnValue(query),
    }));
    const db = { selectDistinctOn } as never;
    const friend = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';

    await mostRecentSharedMealsToday(
      USER_A,
      [USER_A, friend],
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-02T00:00:00Z'),
      db
    );

    const { sql, params } = renderedWhere(query.where);
    expect(sql).toContain(FRIEND_SINCE);
    expect(params).toContain(friend);
    // The self branch and both friendship legs are keyed to the viewer.
    expect(params.filter((p) => p === USER_A).length).toBeGreaterThanOrEqual(3);
  });

  it('skips the query entirely for an empty user list', async () => {
    const selectDistinctOn = vi.fn();

    await expect(
      mostRecentSharedMealsToday(USER_A, [], new Date(), new Date(), {
        selectDistinctOn,
      } as never)
    ).resolves.toEqual([]);
    expect(selectDistinctOn).not.toHaveBeenCalled();
  });
});

describe('toSharedMealEntry', () => {
  it('marks a cheat post as one', () => {
    // The whole difference a shared cheat meal needs on the wire. The post
    // renders the badge and an `≈` from this and nothing else — the sliders,
    // the alcohol figure and the P/C/F breakdown stay on the owner's own card,
    // where someone is actually reading them.
    const row = {
      ...sharedMeal(1, new Date('2026-01-01T00:00:00Z')),
      entryMode: 'cheat',
    };

    expect(toSharedMealEntry(row, USER_A).meal.entryMode).toBe('cheat');
  });

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
