import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// `db.*` is the app singleton (owner role); `tx.*` is the transaction handle
// acceptInvite opens. They are distinct mocks so the profile lookup (db.select)
// never collides with the in-transaction friendship lookup (tx.select).

const {
  mockDbSelect,
  mockDbSelectDistinctOn,
  mockDbInsert,
  mockDbUpdate,
  mockDbDelete,
  mockTxSelect,
  mockTxInsert,
  mockTxUpdate,
  mockTx,
} = vi.hoisted(() => {
  const mockTxSelect = vi.fn();
  const mockTxInsert = vi.fn();
  const mockTxUpdate = vi.fn();
  return {
    mockDbSelect: vi.fn(),
    mockDbSelectDistinctOn: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbDelete: vi.fn(),
    mockTxSelect,
    mockTxInsert,
    mockTxUpdate,
    mockTx: {
      select: mockTxSelect,
      insert: mockTxInsert,
      update: mockTxUpdate,
    },
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: mockDbSelect,
    selectDistinctOn: mockDbSelectDistinctOn,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
    transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx)
    ),
  },
}));

// Export EVERY table groups.ts (AND chat-groups.ts, which acceptInvite now
// calls into) imports — a missing one makes the module-level import
// `undefined` and breaks unrelated queries (the meals.test.ts trap).
vi.mock('@/lib/db/schema', () => ({
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
    status: 'f.status',
    userLow: 'f.userLow',
    userHigh: 'f.userHigh',
    requestedBy: 'f.requestedBy',
    updatedAt: 'f.updatedAt',
  },
  friendsFeedReadMarkers: {
    userId: 'ffrm.userId',
    lastReadAt: 'ffrm.lastReadAt',
  },
  circleEvents: { actorId: 'ce.actorId', type: 'ce.type', refId: 'ce.refId' },
  chatGroups: {
    id: 'cg.id',
    kind: 'cg.kind',
    name: 'cg.name',
    createdBy: 'cg.createdBy',
    directUserLow: 'cg.directUserLow',
    directUserHigh: 'cg.directUserHigh',
    avatarSeed: 'cg.avatarSeed',
    updatedAt: 'cg.updatedAt',
  },
  chatGroupMembers: {
    id: 'cgm.id',
    groupId: 'cgm.groupId',
    userId: 'cgm.userId',
    role: 'cgm.role',
    lastReadAt: 'cgm.lastReadAt',
  },
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
}));

vi.mock('@/lib/groups/shares/reactions', () => ({
  reactionsForShares: vi.fn(
    async (_actorId: string, shareIds: string[]) =>
      new Map(shareIds.map((id) => [id, { count: 0, mine: false }]))
  ),
}));
vi.mock('@/lib/groups/shares/replies', () => ({
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
import { acceptInvite, removeFriend } from '@/lib/actions/groups/friendship';
import {
  getMyPublicProfile,
  getOrCreateMyProfile,
  getProfileBySlug,
  renameMyProfile,
  upsertPublicProfile,
} from '@/lib/actions/groups/profile';
import { repliesForShares } from '@/lib/groups/shares/replies';

// Valid v4 UUIDs (the remove/uuid schemas validate version+variant bits).
const ACTOR = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const INVITER = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const FRIENDSHIP_ID = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const DIRECT_GROUP_ID = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';
const SLUG = 'pho4821';

const inviterRow = {
  userId: INVITER,
  handle: SLUG,
  displayName: 'Phở Fan',
  avatarSeed: SLUG,
  avatarUrl: null,
  avatarPath: null,
};

/** inviterRow through the toPublicIdentity projection. */
const inviterProfile = {
  userId: INVITER,
  handle: SLUG,
  displayName: 'Phở Fan',
  avatarSeed: SLUG,
  avatarUrl: null,
  hasCustomAvatar: false,
};

// A `.from().where().limit()` chain resolving to the given rows (db.select).
function selectRows(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

// The in-transaction read: `.limit(1).for('update')` (locked existing-edge read)
// AND a plain awaited `.limit(1)` (the reconcile read). The limit result is a
// real Promise (so `await` resolves the rows) with `.for()` attached.
function txSelect(rows: unknown[]) {
  const limitResult = Object.assign(Promise.resolve(rows), {
    for: vi.fn().mockResolvedValue(rows),
  });
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue(limitResult),
      }),
    }),
  };
}

// Capture every tx.insert(table).values(vals). The friendship insert chains
// `.onConflictDoNothing().returning()`; the event insert just awaits `.values()`.
function captureInserts() {
  const calls: Record<string, unknown>[] = [];
  mockTxInsert.mockImplementation(() => ({
    values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
      calls.push(vals);
      const chain = {
        returning: vi.fn().mockResolvedValue([{ id: FRIENDSHIP_ID }]),
      };
      return { ...chain, onConflictDoNothing: vi.fn().mockReturnValue(chain) };
    }),
  }));
  return calls;
}

// A friendship insert whose ON CONFLICT DO NOTHING inserted nothing (a racing
// writer won), so `.returning()` is empty.
function insertConflicted() {
  mockTxInsert.mockImplementation(() => ({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  }));
}

// ---------------------------------------------------------------------------
// acceptInvite
// ---------------------------------------------------------------------------

describe('acceptInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default db.select fallback: the recipient already has a link profile, so
    // getOrCreateMyProfile (called before the transaction) short-circuits. The
    // first db.select per test is overridden with .mockReturnValueOnce for the
    // getProfileBySlug lookup; this default serves the getMyPublicProfile read.
    mockDbSelect.mockReturnValue(
      selectRows([
        {
          userId: ACTOR,
          handle: 'mine4821',
          displayName: null,
          avatarSeed: 'mine4821',
        },
      ])
    );
  });

  it('rejects a malformed slug before touching the db', async () => {
    await expect(acceptInvite(ACTOR, { slug: 'no' })).rejects.toThrow();
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('rejects an unknown inviter slug', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([]));
    await expect(acceptInvite(ACTOR, { slug: SLUG })).rejects.toThrow(
      'Liên kết mời không hợp lệ.'
    );
  });

  it('rejects connecting to your own link', async () => {
    mockDbSelect.mockReturnValueOnce(
      selectRows([{ ...inviterRow, userId: ACTOR }])
    );
    await expect(acceptInvite(ACTOR, { slug: SLUG })).rejects.toThrow(
      'Không thể kết nối với chính mình.'
    );
  });

  it('creates an accepted edge crediting the inviter, plus an event and their direct chat', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect
      .mockReturnValueOnce(txSelect([])) // locked read: no existing edge
      .mockReturnValueOnce(txSelect([{ id: DIRECT_GROUP_ID }])); // getOrCreateDirectChatGroup's re-select
    const inserts = captureInserts();

    const result = await acceptInvite(ACTOR, { slug: SLUG });

    expect(result).toEqual({ status: 'accepted', inviter: inviterProfile });
    expect(mockTxUpdate).not.toHaveBeenCalled();
    // friendship + event + chat_groups + chat_group_members
    expect(mockTxInsert).toHaveBeenCalledTimes(4);

    const friendship = inserts.find((v) => 'status' in v);
    expect(friendship?.status).toBe('accepted');
    expect(friendship?.requestedBy).toBe(INVITER); // inviter initiated the link

    const event = inserts.find((v) => v.type === 'friend_accepted');
    expect(event?.refId).toBe(FRIENDSHIP_ID);

    // ACTOR < INVITER lexicographically, so ACTOR is the canonical "low" side.
    const chatGroup = inserts.find((v) => v.kind === 'direct');
    expect(chatGroup).toMatchObject({
      createdBy: ACTOR,
      directUserLow: ACTOR,
      directUserHigh: INVITER,
    });
    const members = inserts.find((v) => Array.isArray(v)) as
      | { groupId: string; userId: string }[]
      | undefined;
    expect(members?.map((m) => m.userId).sort()).toEqual(
      [ACTOR, INVITER].sort()
    );
  });

  it('provisions the recipient profile when they have none yet', async () => {
    mockDbSelect
      .mockReturnValueOnce(selectRows([inviterRow])) // getProfileBySlug
      .mockReturnValueOnce(selectRows([])); // getMyPublicProfile: none yet
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            userId: ACTOR,
            handle: 'mine4821',
            displayName: null,
            avatarSeed: 'mine4821',
          },
        ]),
      }),
    });
    mockTxSelect
      .mockReturnValueOnce(txSelect([])) // no existing edge
      .mockReturnValueOnce(txSelect([{ id: DIRECT_GROUP_ID }])); // getOrCreateDirectChatGroup's re-select
    captureInserts();

    const result = await acceptInvite(ACTOR, { slug: SLUG });

    expect(result.status).toBe('accepted');
    expect(mockDbInsert).toHaveBeenCalledTimes(1); // recipient was provisioned
  });

  it('promotes a pending edge to accepted, and creates their direct chat', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect
      .mockReturnValueOnce(txSelect([{ id: FRIENDSHIP_ID, status: 'pending' }]))
      .mockReturnValueOnce(txSelect([{ id: DIRECT_GROUP_ID }])); // getOrCreateDirectChatGroup's re-select
    mockTxUpdate.mockReturnValue({
      set: vi
        .fn()
        .mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    const inserts = captureInserts();

    const result = await acceptInvite(ACTOR, { slug: SLUG });

    expect(result.status).toBe('accepted');
    expect(mockTxUpdate).toHaveBeenCalledTimes(1);
    // event + chat_groups + chat_group_members
    expect(mockTxInsert).toHaveBeenCalledTimes(3);
    expect(inserts[0]?.type).toBe('friend_accepted');
    expect(inserts[0]?.refId).toBe(FRIENDSHIP_ID);
    expect(inserts.find((v) => v.kind === 'direct')).toMatchObject({
      directUserLow: ACTOR,
      directUserHigh: INVITER,
    });
  });

  it('is a no-op when already connected', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect.mockReturnValueOnce(
      txSelect([{ id: FRIENDSHIP_ID, status: 'accepted' }])
    );

    const result = await acceptInvite(ACTOR, { slug: SLUG });

    expect(result.status).toBe('accepted');
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('refuses to connect over a blocked edge', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect.mockReturnValueOnce(
      txSelect([{ id: FRIENDSHIP_ID, status: 'blocked' }])
    );

    await expect(acceptInvite(ACTOR, { slug: SLUG })).rejects.toThrow(
      'Không thể kết nối.'
    );
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('stays idempotent when a concurrent accept wins the insert race', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect
      .mockReturnValueOnce(txSelect([])) // locked read: no edge
      .mockReturnValueOnce(txSelect([{ status: 'accepted' }])) // reconcile read
      .mockReturnValueOnce(txSelect([{ id: DIRECT_GROUP_ID }])); // getOrCreateDirectChatGroup's re-select
    insertConflicted();

    const result = await acceptInvite(ACTOR, { slug: SLUG });

    expect(result.status).toBe('accepted');
  });

  it('refuses when a concurrent block wins the insert race', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect
      .mockReturnValueOnce(txSelect([])) // locked read: no edge
      .mockReturnValueOnce(txSelect([{ status: 'blocked' }])); // reconcile read
    insertConflicted();

    await expect(acceptInvite(ACTOR, { slug: SLUG })).rejects.toThrow(
      'Không thể kết nối.'
    );
  });
});

// ---------------------------------------------------------------------------
// removeFriend
// ---------------------------------------------------------------------------

describe('removeFriend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects removing yourself', async () => {
    await expect(removeFriend(ACTOR, { targetUserId: ACTOR })).rejects.toThrow(
      'Không thể xoá chính mình.'
    );
    expect(mockDbDelete).not.toHaveBeenCalled();
  });

  it('rejects a non-uuid target', async () => {
    await expect(
      removeFriend(ACTOR, { targetUserId: 'not-a-uuid' })
    ).rejects.toThrow();
    expect(mockDbDelete).not.toHaveBeenCalled();
  });

  it('deletes the canonical edge', async () => {
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const result = await removeFriend(ACTOR, { targetUserId: INVITER });

    expect(result).toEqual({ removed: true });
    expect(mockDbDelete).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getProfileBySlug
// ---------------------------------------------------------------------------

describe('getProfileBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for a malformed slug without querying', async () => {
    expect(await getProfileBySlug('!!')).toBeNull();
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('returns the matching profile', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    expect(await getProfileBySlug(SLUG)).toEqual(inviterProfile);
  });

  it('returns null when no profile matches', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([]));
    expect(await getProfileBySlug(SLUG)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getOrCreateMyProfile
// ---------------------------------------------------------------------------

describe('getOrCreateMyProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the existing profile without provisioning', async () => {
    mockDbSelect.mockReturnValueOnce(
      selectRows([{ ...inviterRow, userId: ACTOR }])
    );

    const result = await getOrCreateMyProfile(ACTOR);

    expect(result.userId).toBe(ACTOR);
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('provisions a generated link on first use', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([])); // none yet
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            userId: ACTOR,
            handle: 'cafe1234',
            displayName: null,
            avatarSeed: 'cafe1234',
          },
        ]),
      }),
    });

    const result = await getOrCreateMyProfile(ACTOR);

    expect(result.userId).toBe(ACTOR);
    expect(result.handle).toBe('cafe1234');
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
  });
});

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

// ---------------------------------------------------------------------------
// upsertPublicProfile — tri-state displayName (omitted=keep, null=clear)
// ---------------------------------------------------------------------------

describe('upsertPublicProfile', () => {
  // Capture the insert values and the ON CONFLICT update set.
  function captureUpsert() {
    const captured: {
      values?: Record<string, unknown>;
      set?: Record<string, unknown>;
    } = {};
    mockDbInsert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        captured.values = vals;
        return {
          onConflictDoUpdate: vi
            .fn()
            .mockImplementation((cfg: { set: Record<string, unknown> }) => {
              captured.set = cfg.set;
              return {
                returning: vi.fn().mockResolvedValue([
                  {
                    userId: ACTOR,
                    handle: SLUG,
                    displayName: 'Phở Fan',
                    avatarSeed: SLUG,
                  },
                ]),
              };
            }),
        };
      }),
    }));
    return captured;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Handle-taken pre-check: not taken.
    mockDbSelect.mockReturnValue(selectRows([]));
  });

  it('a slug-only save preserves the stored display name and avatar seed', async () => {
    const captured = captureUpsert();

    await upsertPublicProfile(ACTOR, { handle: SLUG });

    // The update set must NOT touch displayName/avatarSeed when omitted —
    // this is the regression where renaming your link wiped your name.
    expect(captured.set).not.toHaveProperty('displayName');
    expect(captured.set).not.toHaveProperty('avatarSeed');
    expect(captured.set).toHaveProperty('handle', SLUG);
  });

  it('an explicit null clears the display name', async () => {
    const captured = captureUpsert();

    await upsertPublicProfile(ACTOR, { handle: SLUG, displayName: null });

    expect(captured.set).toHaveProperty('displayName', null);
  });

  it('a provided display name is set on both insert and update', async () => {
    const captured = captureUpsert();

    await upsertPublicProfile(ACTOR, { handle: SLUG, displayName: 'Bún Chả' });

    expect(captured.values).toHaveProperty('displayName', 'Bún Chả');
    expect(captured.set).toHaveProperty('displayName', 'Bún Chả');
  });

  it('rejects an empty-string display name (clear is null, not "")', async () => {
    captureUpsert();

    await expect(
      upsertPublicProfile(ACTOR, { handle: SLUG, displayName: '' })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// renameMyProfile — display name + handle cascade
// ---------------------------------------------------------------------------

describe('renameMyProfile', () => {
  // Capture every db.update(...).set(...) and script per-call outcomes:
  // an entry in `fails` at index i makes the i-th update throw 23505.
  function captureUpdates(fails: number[] = []) {
    const sets: Record<string, unknown>[] = [];
    let call = 0;
    mockDbUpdate.mockImplementation(() => ({
      set: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        sets.push(vals);
        const failing = fails.includes(call);
        call += 1;
        return {
          where: vi.fn().mockReturnValue({
            returning: failing
              ? vi
                  .fn()
                  .mockRejectedValue(
                    Object.assign(new Error('dup'), { code: '23505' })
                  )
              : vi.fn().mockImplementation(() =>
                  Promise.resolve([
                    {
                      userId: ACTOR,
                      handle: (vals.handle as string) ?? 'mine4821',
                      displayName: vals.displayName ?? null,
                      avatarSeed: 'mine4821',
                      avatarUrl: null,
                      avatarPath: null,
                    },
                  ])
                ),
          }),
        };
      }),
    }));
    return sets;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // getOrCreateMyProfile: the actor already has a provisioned profile.
    mockDbSelect.mockReturnValue(
      selectRows([
        {
          userId: ACTOR,
          handle: 'mine4821',
          displayName: null,
          avatarSeed: 'mine4821',
          avatarUrl: null,
          avatarPath: null,
        },
      ])
    );
  });

  it('sets the name and re-derives the handle from it (diacritics stripped)', async () => {
    const sets = captureUpdates();

    const result = await renameMyProfile(ACTOR, 'Đặng Thu Hà');

    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({
      displayName: 'Đặng Thu Hà',
      handle: 'dangthuha',
    });
    expect(result.handle).toBe('dangthuha');
    expect(result.displayName).toBe('Đặng Thu Hà');
  });

  it('keeps the current handle when the derived slug already matches it', async () => {
    mockDbSelect.mockReturnValue(
      selectRows([
        {
          userId: ACTOR,
          handle: 'dangthuha42', // earlier collision suffix on the same base
          displayName: 'Đặng Thu Hà',
          avatarSeed: 'x',
          avatarUrl: null,
          avatarPath: null,
        },
      ])
    );
    const sets = captureUpdates();

    await renameMyProfile(ACTOR, 'Đặng Thu Hà!');

    expect(sets).toHaveLength(1);
    expect(sets[0]).not.toHaveProperty('handle');
  });

  it('suffixes digits and retries on a handle collision', async () => {
    const sets = captureUpdates([0]); // first update hits 23505

    const result = await renameMyProfile(ACTOR, 'Thu Ha');

    expect(sets).toHaveLength(2);
    expect(sets[0]).toMatchObject({ handle: 'thuha' });
    expect(sets[1].handle).toMatch(/^thuha\d{2,4}$/u);
    expect(result.handle).toMatch(/^thuha\d{2,4}$/u);
  });

  it('suffixes a reserved base instead of using it bare', async () => {
    const sets = captureUpdates();

    await renameMyProfile(ACTOR, 'Admin');

    expect(sets).toHaveLength(1);
    expect(sets[0].handle).toMatch(/^admin\d{2,4}$/u);
  });

  it('rejects an empty name', async () => {
    captureUpdates();
    await expect(renameMyProfile(ACTOR, '   ')).rejects.toThrow();
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getMyPublicProfile — uploaded avatar_path wins over the OAuth avatar_url
// ---------------------------------------------------------------------------

describe('getMyPublicProfile avatar URL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps a stored avatar path to the public bucket URL over the OAuth one', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co');
    mockDbSelect.mockReturnValueOnce(
      selectRows([
        {
          userId: ACTOR,
          handle: 'mine4821',
          displayName: 'Khoi',
          avatarSeed: 'mine4821',
          avatarUrl: 'https://lh3.googleusercontent.com/x',
          avatarPath: `${ACTOR}/abc.jpg`,
        },
      ])
    );

    const result = await getMyPublicProfile(ACTOR);

    expect(result?.avatarUrl).toBe(
      `https://proj.supabase.co/storage/v1/object/public/avatars/${ACTOR}/abc.jpg`
    );
    vi.unstubAllEnvs();
  });

  it('falls back to the OAuth picture when no photo is uploaded', async () => {
    mockDbSelect.mockReturnValueOnce(
      selectRows([
        {
          ...inviterRow,
          avatarUrl: 'https://lh3.googleusercontent.com/x',
          avatarPath: null,
        },
      ])
    );
    const result = await getMyPublicProfile(INVITER);
    expect(result?.avatarUrl).toBe('https://lh3.googleusercontent.com/x');
  });
});
