import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — the feed reads run entirely on the `db` singleton (owner role).
// ---------------------------------------------------------------------------

const { mockDbSelect, mockDbSelectDistinctOn, mockDbInsert } = vi.hoisted(
  () => ({
    mockDbSelect: vi.fn(),
    mockDbSelectDistinctOn: vi.fn(),
    mockDbInsert: vi.fn(),
  })
);

vi.mock('@/lib/infra/db', () => ({
  db: {
    select: mockDbSelect,
    selectDistinctOn: mockDbSelectDistinctOn,
    insert: mockDbInsert,
  },
}));

vi.mock(
  '@/lib/infra/db/schema',
  async () => (await import('./circle-doubles')).schema
);

vi.mock('@/lib/domain/social/shares/reactions', () => ({
  reactionsForShares: vi.fn(
    async (_actorId: string, shareIds: string[]) =>
      new Map(shareIds.map((id) => [id, { count: 0, mine: false }]))
  ),
}));
vi.mock('@/lib/domain/social/shares/replies', () => ({
  repliesForShares: vi.fn(
    async (_actorId: string, shareIds: string[]) =>
      new Map(shareIds.map((id) => [id, { replies: [], total: 0 }]))
  ),
}));

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import {
  getFriendsFeedReadMarker,
  listCircleFeed,
  listFriendsThreadFeed,
} from '@/lib/actions/groups/feed';
import { repliesForShares } from '@/lib/domain/social/shares/replies';
import { ACTOR, INVITER, selectRows } from './circle-doubles';

// ---------------------------------------------------------------------------
// listCircleFeed — the actor at their own table + accepted-only scoping
// ---------------------------------------------------------------------------

describe('listCircleFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const FRIEND = INVITER;

  // The accepted-friends lookup: db.select().from().where().orderBy().
  function friendsQuery(rows: unknown[]) {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(rows),
        }),
      }),
    });
  }

  // The per-user most-recent-shared-meal lookup: selectDistinctOn(...)
  // .from().innerJoin().innerJoin().where().orderBy(). Capture the where args so
  // the test can assert the actor is included in the inArray scope.
  function mealsQuery(rows: unknown[], capture?: { where?: unknown }) {
    mockDbSelectDistinctOn.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation((arg: unknown) => {
              if (capture) capture.where = arg;
              return { orderBy: vi.fn().mockResolvedValue(rows) };
            }),
          }),
        }),
      }),
    });
  }

  function sharedMeal(userId: string, sharedAt: Date, handle: string) {
    return {
      friendUserId: userId,
      mealId: `meal-${userId}`,
      shareId: `share-${userId}`,
      rawInput: `${handle} meal`,
      caloriesKcal: 500,
      proteinG: 20,
      carbohydrateG: 50,
      fatG: 15,
      portionFactor: 1,
      sharedAt,
      loggedAt: sharedAt,
      handle,
      displayName: null,
      avatarSeed: handle,
    };
  }

  it('places the actor first (their own table) and tags it isSelf', async () => {
    friendsQuery([{ userLow: ACTOR, userHigh: FRIEND }]);
    // Friend shared more recently, but the actor's own meal must still lead.
    mealsQuery([
      sharedMeal(FRIEND, new Date('2026-05-03T10:00:00Z'), 'phofan'),
      sharedMeal(ACTOR, new Date('2026-05-03T08:00:00Z'), 'me'),
    ]);

    const feed = await listCircleFeed(ACTOR, { timezoneOffset: 0 });

    expect(feed).toHaveLength(2);
    expect(feed[0]?.isSelf).toBe(true);
    expect(feed[0]?.friend.userId).toBe(ACTOR);
    expect(feed[1]?.isSelf).toBe(false);
    expect(feed[1]?.friend.userId).toBe(FRIEND);
  });

  it('returns the bounded reply total enrichment on ambient entries', async () => {
    const sharedAt = new Date('2026-05-03T08:00:00Z');
    friendsQuery([]);
    mealsQuery([sharedMeal(ACTOR, sharedAt, 'me')]);
    vi.mocked(repliesForShares).mockResolvedValueOnce(
      new Map([
        [
          `share-${ACTOR}`,
          {
            replies: [],
            total: 17,
          },
        ],
      ])
    );

    const [entry] = await listCircleFeed(ACTOR, { timezoneOffset: 0 });

    expect(entry?.replies).toEqual([]);
    expect(entry?.repliesTotal).toBe(17);
  });

  it('still returns the actor own meal with zero friends', async () => {
    friendsQuery([]); // no accepted friends
    mealsQuery([sharedMeal(ACTOR, new Date('2026-05-03T08:00:00Z'), 'me')]);

    const feed = await listCircleFeed(ACTOR, { timezoneOffset: 0 });

    expect(feed).toHaveLength(1);
    expect(feed[0]?.isSelf).toBe(true);
  });

  it('scopes the meal query to the actor + accepted friends only', async () => {
    // The friendIds set is derived from accepted edges, so a user only ever
    // sees their own meal and accepted friends meals — never an arbitrary user.
    friendsQuery([{ userLow: ACTOR, userHigh: FRIEND }]);
    const capture: { where?: unknown } = {};
    mealsQuery([], capture);

    await listCircleFeed(ACTOR, { timezoneOffset: 0 });

    // The serialized predicate must reference both the actor and the friend id.
    const serialized = JSON.stringify(capture.where ?? {});
    expect(serialized).toContain(ACTOR);
    expect(serialized).toContain(FRIEND);
  });
});

// ---------------------------------------------------------------------------
// listFriendsThreadFeed — the combined Friends thread's paginated history
// ---------------------------------------------------------------------------

describe('listFriendsThreadFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const FRIEND = INVITER;

  // sharedMealsBefore: the accepted-friend LEFT JOIN and actor's own shares
  // are authorized in this one query.
  function sharedMealsBeforeQuery(
    rows: unknown[],
    capture?: { where?: unknown }
  ) {
    const query = {
      innerJoin: vi.fn(),
      leftJoin: vi.fn(),
      where: vi.fn().mockImplementation((arg: unknown) => {
        if (capture) capture.where = arg;
        return query;
      }),
      orderBy: vi.fn(),
      limit: vi.fn().mockResolvedValue(rows),
    };
    query.innerJoin.mockReturnValue(query);
    query.leftJoin.mockReturnValue(query);
    query.orderBy.mockReturnValue(query);
    mockDbSelect.mockReturnValueOnce({ from: vi.fn().mockReturnValue(query) });
  }

  function sharedMeal(userId: string, index: number, sharedAt: Date) {
    return {
      friendUserId: userId,
      mealId: `meal-${index}`,
      shareId: `00000000-0000-4000-8000-${index
        .toString(16)
        .padStart(12, '0')}`,
      rawInput: `meal ${index}`,
      caloriesKcal: 500,
      proteinG: 20,
      carbohydrateG: 50,
      fatG: 15,
      portionFactor: 1,
      sharedAt,
      loggedAt: sharedAt,
      sharedAtText: sharedAt.toISOString(),
      handle: 'phofan',
      displayName: null,
      avatarSeed: 'phofan',
      avatarUrl: null,
    };
  }

  function stubReadMarkerUpsert(capture?: { values?: unknown; set?: unknown }) {
    mockDbInsert.mockReturnValue({
      values: vi.fn((values: unknown) => {
        if (capture) capture.values = values;
        return {
          onConflictDoUpdate: vi.fn((config: { set: unknown }) => {
            if (capture) capture.set = config.set;
            return Promise.resolve(undefined);
          }),
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        };
      }),
    });
  }

  it('scopes the meal query to the actor and accepted friendship edge', async () => {
    const capture: { where?: unknown } = {};
    sharedMealsBeforeQuery([], capture);
    stubReadMarkerUpsert();

    await listFriendsThreadFeed(ACTOR, {});

    const serialized = JSON.stringify(capture.where ?? {});
    expect(serialized).toContain(ACTOR);
    expect(mockDbSelect).toHaveBeenCalledTimes(1);
  });

  it('returns every shared meal, not collapsed to one per day, all tagged isSelf: false', async () => {
    sharedMealsBeforeQuery([
      sharedMeal(FRIEND, 2, new Date('2026-01-01T18:00:00Z')), // dinner
      sharedMeal(FRIEND, 1, new Date('2026-01-01T08:00:00Z')), // breakfast, same day
    ]);
    stubReadMarkerUpsert();

    const page = await listFriendsThreadFeed(ACTOR, {});

    expect(page.entries).toHaveLength(2);
    expect(page.entries.every((e) => !e.isSelf)).toBe(true);
    expect(page.nextCursor).toBeNull();
  });

  it('forwards the before cursor and reports nextCursor when more history remains', async () => {
    // 21 rows for the default page size of 20 signals more history exists.
    const rows = Array.from({ length: 21 }, (_, i) =>
      sharedMeal(FRIEND, i, new Date(Date.UTC(2026, 0, 21 - i)))
    );
    sharedMealsBeforeQuery(rows);

    const page = await listFriendsThreadFeed(ACTOR, {
      before: '2026-01-22T00:00:00.000Z',
    });

    expect(page.entries).toHaveLength(20);
    expect(page.nextCursor).not.toBeNull();
  });

  it('returns an empty page without advancing the read marker', async () => {
    sharedMealsBeforeQuery([]);

    const page = await listFriendsThreadFeed(ACTOR, {});

    expect(page.entries).toEqual([]);
    expect(page.nextCursor).toBeNull();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('bumps the read marker on page 1', async () => {
    const newest = new Date('2026-01-22T00:00:00.000Z');
    const marker: { values?: unknown; set?: unknown } = {};
    sharedMealsBeforeQuery([sharedMeal(FRIEND, 1, newest)]);
    stubReadMarkerUpsert(marker);

    await listFriendsThreadFeed(ACTOR, {});

    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    expect(marker.values).toEqual({ userId: ACTOR, lastReadAt: newest });
    expect(JSON.stringify(marker.set)).toContain('GREATEST');
    expect(JSON.stringify(marker.set)).toContain(newest.toISOString());
  });

  it('does not touch the read marker when paginating with a before cursor', async () => {
    sharedMealsBeforeQuery([]);

    await listFriendsThreadFeed(ACTOR, {
      before: '2026-01-22T00:00:00.000Z',
    });

    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('does not advance the marker when reply enrichment fails', async () => {
    sharedMealsBeforeQuery([
      sharedMeal(FRIEND, 1, new Date('2026-01-22T00:00:00.000Z')),
    ]);
    vi.mocked(repliesForShares).mockRejectedValueOnce(
      new Error('reply read failed')
    );

    await expect(listFriendsThreadFeed(ACTOR, {})).rejects.toThrow(
      'reply read failed'
    );
    expect(mockDbInsert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getFriendsFeedReadMarker — lazily provisions on first read
// ---------------------------------------------------------------------------

describe('getFriendsFeedReadMarker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provisions the row on first read and returns its lastReadAt', async () => {
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockDbSelect.mockReturnValueOnce(
      selectRows([{ lastReadAt: new Date('2026-01-01T00:00:00Z') }])
    );

    const marker = await getFriendsFeedReadMarker(ACTOR);

    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    expect(marker.lastReadAt).toBe('2026-01-01T00:00:00.000Z');
  });
});
