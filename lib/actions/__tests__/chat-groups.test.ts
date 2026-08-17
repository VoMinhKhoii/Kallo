import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// `db.*` is the app singleton (owner role); `tx.*` is the transaction handle
// createChatGroup opens.

const {
  mockDbSelect,
  mockDbSelectDistinctOn,
  mockDbInsert,
  mockDbUpdate,
  mockDbTransaction,
  mockTxInsert,
  mockTxSelect,
  mockTxDelete,
  mockTx,
} = vi.hoisted(() => {
  const mockTxInsert = vi.fn();
  const mockTxSelect = vi.fn();
  const mockTxDelete = vi.fn();
  return {
    mockDbSelect: vi.fn(),
    mockDbSelectDistinctOn: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbTransaction: vi.fn(),
    mockTxInsert,
    mockTxSelect,
    mockTxDelete,
    mockTx: {
      insert: mockTxInsert,
      select: mockTxSelect,
      delete: mockTxDelete,
    },
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: mockDbSelect,
    selectDistinctOn: mockDbSelectDistinctOn,
    insert: mockDbInsert,
    update: mockDbUpdate,
    transaction: mockDbTransaction,
  },
}));

vi.mock('drizzle-orm/pg-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm/pg-core')>();
  return { ...actual, alias: (table: unknown) => table };
});

// Export EVERY table chat-groups.ts imports — a missing one makes the
// module-level import `undefined` and breaks unrelated queries.
vi.mock('@/lib/db/schema', () => ({
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
    joinedAt: 'cgm.joinedAt',
  },
  chatGroupMessages: {
    id: 'cgmsg.id',
    groupId: 'cgmsg.groupId',
    senderId: 'cgmsg.senderId',
    body: 'cgmsg.body',
    createdAt: 'cgmsg.createdAt',
  },
  friendships: {
    id: 'f.id',
    status: 'f.status',
    userLow: 'f.userLow',
    userHigh: 'f.userHigh',
  },
  meals: {
    id: 'm.id',
    userId: 'm.userId',
  },
  mealShares: {
    id: 'ms.id',
    mealId: 'ms.mealId',
    actorId: 'ms.actorId',
    visibility: 'ms.visibility',
    sharedAt: 'ms.sharedAt',
  },
  publicProfiles: {
    userId: 'pp.userId',
    handle: 'pp.handle',
    displayName: 'pp.displayName',
    avatarSeed: 'pp.avatarSeed',
    avatarUrl: 'pp.avatarUrl',
  },
}));

vi.mock('@/lib/social/shares/reactions', () => ({
  reactionsForShares: vi.fn(
    async (_actorId: string, shareIds: string[]) =>
      new Map(shareIds.map((id) => [id, { count: 0, mine: false }]))
  ),
}));
vi.mock('@/lib/social/shares/replies', () => ({
  repliesForShares: vi.fn(
    async (_actorId: string, shareIds: string[]) =>
      new Map(shareIds.map((id) => [id, { replies: [], total: 0 }]))
  ),
}));

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import {
  createChatGroup,
  getChatGroup,
  getOrCreateDirectChatGroup,
  leaveChatGroup,
  listChatGroupMessages,
  listGroupMealFeed,
  listMyChatGroups,
  sendChatGroupMessage,
} from '@/lib/actions/chat-groups';
import { reactionsForShares } from '@/lib/social/shares/reactions';

const USER_A = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const USER_B = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const USER_C = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const GROUP_ID = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';
const DIRECT_GROUP_ID = 'e4ccef33-df4f-4cc2-af0f-0ffdf0724e55';
const [LOW, HIGH] = USER_A < USER_B ? [USER_A, USER_B] : [USER_B, USER_A];

// A `.from()[.innerJoin()...].where().limit()` chain resolving to the given
// rows (db.select). innerJoin returns the same level so chains with zero or
// more joins (requireMembership joins chat_groups) all land on where().limit().
function selectRows(rows: unknown[]) {
  const level: Record<string, ReturnType<typeof vi.fn>> = {
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(rows),
    }),
    innerJoin: vi.fn(),
  };
  level.innerJoin.mockReturnValue(level);
  return { from: vi.fn().mockReturnValue(level) };
}

function acceptedFriendsQuery(friendIds: string[]) {
  mockDbSelect.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(
        friendIds.map((friendId) => ({
          userLow: USER_A < friendId ? USER_A : friendId,
          userHigh: USER_A < friendId ? friendId : USER_A,
        }))
      ),
    }),
  });
}

function accessRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    kind: 'group',
    role: 'member',
    joinedAt: new Date('2020-01-01T00:00:00.000Z'),
    directUserLow: null,
    directUserHigh: null,
    directFriendAccepted: true,
    ...overrides,
  };
}

// A stub update chain: db.update(table).set(vals).where(cond) -> resolves.
function stubUpdate(capture?: { set?: unknown }) {
  mockDbUpdate.mockReturnValue({
    set: vi.fn((values: unknown) => {
      if (capture) capture.set = values;
      return { where: vi.fn().mockResolvedValue(undefined) };
    }),
  });
}

describe('getOrCreateDirectChatGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the pair in canonical order and ensures both member rows', async () => {
    const insertCalls: unknown[] = [];
    mockDbInsert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((vals: unknown) => {
        insertCalls.push(vals);
        return { onConflictDoNothing: vi.fn().mockResolvedValue(undefined) };
      }),
    }));
    mockDbSelect.mockReturnValueOnce(selectRows([{ id: GROUP_ID }]));

    // Call with args in reverse-of-canonical order — the function must still
    // resolve to the low/high canonical ordering, not argument order.
    const result = await getOrCreateDirectChatGroup(HIGH, LOW);

    expect(result).toEqual({ id: GROUP_ID });
    const groupInsert = insertCalls[0] as Record<string, unknown>;
    expect(groupInsert.kind).toBe('direct');
    expect(groupInsert.directUserLow).toBe(LOW);
    expect(groupInsert.directUserHigh).toBe(HIGH);

    const memberInsert = insertCalls[1] as {
      groupId: string;
      userId: string;
    }[];
    expect(memberInsert).toHaveLength(2);
    expect(memberInsert.map((m) => m.userId).sort()).toEqual(
      [LOW, HIGH].sort()
    );
  });
});

describe('createChatGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbTransaction.mockImplementation((fn: (tx: typeof mockTx) => unknown) =>
      fn(mockTx)
    );
  });

  it('rejects a member who is not an accepted friend', async () => {
    acceptedFriendsQuery([]);

    await expect(
      createChatGroup(USER_A, { name: 'Trip', memberUserIds: [USER_B] })
    ).rejects.toThrow('Chỉ có thể thêm bạn bè đã kết nối vào nhóm.');
    expect(mockDbTransaction).not.toHaveBeenCalled();
  });

  it('rejects when every member is filtered down to none (self-only selection)', async () => {
    await expect(
      createChatGroup(USER_A, { name: 'Trip', memberUserIds: [USER_A] })
    ).rejects.toThrow('Chọn ít nhất một thành viên.');
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('creates the group with the actor as owner and members as accepted friends', async () => {
    acceptedFriendsQuery([USER_B, USER_C]);

    const txCalls: unknown[] = [];
    mockTxInsert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((vals: unknown) => {
        txCalls.push(vals);
        return { returning: vi.fn().mockResolvedValue([{ id: GROUP_ID }]) };
      }),
    }));

    const result = await createChatGroup(USER_A, {
      name: 'Trip',
      memberUserIds: [USER_B, USER_C],
    });

    expect(result).toEqual({ id: GROUP_ID });
    const groupInsert = txCalls[0] as Record<string, unknown>;
    expect(groupInsert.kind).toBe('group');
    expect(groupInsert.name).toBe('Trip');

    const memberInserts = txCalls[1] as { userId: string; role: string }[];
    expect(memberInserts).toContainEqual({
      groupId: GROUP_ID,
      userId: USER_A,
      role: 'owner',
    });
    expect(memberInserts).toContainEqual({
      groupId: GROUP_ID,
      userId: USER_B,
      role: 'member',
    });
  });
});

describe('listMyChatGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // db.select().from().where() -> the actor's accepted friends, consulted by
  // the backfill (ensureDirectChatsForAcceptedFriends) before every list read.
  function friendsBackfillQuery(rows: unknown[]) {
    const query = {
      leftJoin: vi.fn(),
      where: vi.fn().mockResolvedValue(rows),
    };
    query.leftJoin.mockReturnValue(query);
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue(query),
    });
  }

  // db.select().from().innerJoin().where().orderBy() -> the actor's groups.
  function myGroupsQuery(rows: unknown[]) {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    });
  }

  // db.select().from().innerJoin().where() -> the other direct-chat member.
  function otherMemberQuery(rows: unknown[]) {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(rows),
        }),
      }),
    });
  }

  // db.selectDistinctOn().from().where().orderBy() -> last message per group.
  function lastMessagesQuery(rows: unknown[]) {
    mockDbSelectDistinctOn.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(rows),
        }),
      }),
    });
  }

  // db.select().from().innerJoin()*.where().groupBy() -> each
  // group's most recent shared meal today (any member).
  function lastMealSharesQuery(rows: unknown[]) {
    const level: Record<string, ReturnType<typeof vi.fn>> = {
      innerJoin: vi.fn(),
      where: vi.fn().mockReturnValue({
        groupBy: vi.fn().mockResolvedValue(rows),
      }),
    };
    level.innerJoin.mockReturnValue(level);
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue(level),
    });
  }

  it('marks a group chat unread when the last message postdates the read marker', async () => {
    friendsBackfillQuery([]); // no accepted friends to backfill
    const lastReadAt = new Date('2026-01-01T00:00:00Z');
    myGroupsQuery([
      {
        id: GROUP_ID,
        kind: 'group',
        name: 'Trip',
        avatarSeed: null,
        updatedAt: new Date('2026-01-01T01:00:00Z'),
        lastReadAt,
        unread: true,
      },
    ]);
    lastMessagesQuery([
      {
        groupId: GROUP_ID,
        body: 'See you there!',
        createdAt: new Date('2026-01-01T00:30:00Z'), // after lastReadAt
      },
    ]);
    lastMealSharesQuery([]);

    const [entry] = await listMyChatGroups(USER_A, { timezoneOffset: 0 });

    expect(entry.title).toBe('Trip');
    expect(entry.lastMessagePreview).toBe('See you there!');
    expect(entry.unread).toBe(true);
  });

  it('is read when the last message predates the read marker', async () => {
    friendsBackfillQuery([]);
    const lastReadAt = new Date('2026-01-02T00:00:00Z');
    myGroupsQuery([
      {
        id: GROUP_ID,
        kind: 'group',
        name: 'Trip',
        avatarSeed: null,
        updatedAt: new Date('2026-01-01T01:00:00Z'),
        lastReadAt,
        unread: false,
      },
    ]);
    lastMessagesQuery([
      {
        groupId: GROUP_ID,
        body: 'See you there!',
        createdAt: new Date('2026-01-01T00:30:00Z'), // before lastReadAt
      },
    ]);
    lastMealSharesQuery([]);

    const [entry] = await listMyChatGroups(USER_A, { timezoneOffset: 0 });

    expect(entry.unread).toBe(false);
  });

  it('surfaces the most recent shared meal among a group’s members today', async () => {
    friendsBackfillQuery([]);
    myGroupsQuery([
      {
        id: GROUP_ID,
        kind: 'group',
        name: 'Trip',
        avatarSeed: null,
        updatedAt: new Date('2026-01-01T01:00:00Z'),
        lastReadAt: new Date('2026-01-01T00:00:00Z'),
        unread: true,
      },
    ]);
    lastMessagesQuery([]);
    lastMealSharesQuery([
      { groupId: GROUP_ID, lastSharedAt: new Date('2026-01-01T02:00:00Z') },
    ]);

    const [entry] = await listMyChatGroups(USER_A, { timezoneOffset: 0 });

    expect(entry.lastMealSharedAt).toBe('2026-01-01T02:00:00.000Z');
  });

  it('has a null lastMealSharedAt when no member shared a meal today', async () => {
    friendsBackfillQuery([]);
    myGroupsQuery([
      {
        id: GROUP_ID,
        kind: 'group',
        name: 'Trip',
        avatarSeed: null,
        updatedAt: new Date('2026-01-01T01:00:00Z'),
        lastReadAt: new Date('2026-01-01T00:00:00Z'),
        unread: false,
      },
    ]);
    lastMessagesQuery([]);
    lastMealSharesQuery([]);

    const [entry] = await listMyChatGroups(USER_A, { timezoneOffset: 0 });

    expect(entry.lastMealSharedAt).toBeNull();
  });

  it('resolves a direct chat title to the OTHER member, not the actor', async () => {
    // The counterpart must be a current accepted friend or the direct chat is
    // gated out of the list (removed/blocked friends' chats don't surface).
    friendsBackfillQuery([
      { userLow: LOW, userHigh: HIGH, groupId: DIRECT_GROUP_ID },
    ]);
    myGroupsQuery([
      {
        id: DIRECT_GROUP_ID,
        kind: 'direct',
        name: null,
        avatarSeed: null,
        updatedAt: new Date('2026-01-01T01:00:00Z'),
        lastReadAt: new Date('2026-01-01T01:00:00Z'),
        directUserLow: LOW,
        directUserHigh: HIGH,
        unread: false,
      },
    ]);
    otherMemberQuery([
      {
        groupId: DIRECT_GROUP_ID,
        handle: 'phofan',
        displayName: 'Phở Fan',
        avatarSeed: 'phofan',
      },
    ]);
    lastMessagesQuery([]);
    lastMealSharesQuery([]);

    const [entry] = await listMyChatGroups(USER_A, { timezoneOffset: 0 });

    expect(entry.title).toBe('Phở Fan');
    expect(entry.lastMessagePreview).toBeNull();
    expect(entry.unread).toBe(false);
  });

  it('hides a direct chat whose counterpart is no longer an accepted friend', async () => {
    // Membership row survives a remove/block, but with no accepted friendship
    // the direct chat must not appear (matching requireMembership's gate).
    friendsBackfillQuery([]); // no accepted friends
    myGroupsQuery([
      {
        id: DIRECT_GROUP_ID,
        kind: 'direct',
        name: null,
        avatarSeed: null,
        updatedAt: new Date('2026-01-01T01:00:00Z'),
        lastReadAt: new Date('2026-01-01T01:00:00Z'),
        directUserLow: LOW,
        directUserHigh: HIGH,
        unread: false,
      },
    ]);
    // No direct groups survive the filter, so the other-member / message /
    // meal queries never run — none are queued.

    const result = await listMyChatGroups(USER_A, { timezoneOffset: 0 });

    expect(result).toHaveLength(0);
  });

  it('backfills a direct chat for an accepted friend who never got one, so they still show up', async () => {
    // One accepted friend with no existing chat_groups row for the pair.
    friendsBackfillQuery([
      { userLow: USER_A, userHigh: USER_B, groupId: null },
    ]);
    mockDbInsert
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: DIRECT_GROUP_ID,
                userLow: USER_A,
                userHigh: USER_B,
              },
            ]),
          }),
        }),
      })
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      });

    myGroupsQuery([
      {
        id: DIRECT_GROUP_ID,
        kind: 'direct',
        name: null,
        avatarSeed: null,
        updatedAt: new Date('2026-01-01T01:00:00Z'),
        lastReadAt: new Date('2026-01-01T01:00:00Z'),
        directUserLow: LOW,
        directUserHigh: HIGH,
        unread: false,
      },
    ]);
    otherMemberQuery([
      {
        groupId: DIRECT_GROUP_ID,
        handle: 'phofan',
        displayName: 'Phở Fan',
        avatarSeed: 'phofan',
      },
    ]);
    lastMessagesQuery([]);
    lastMealSharesQuery([]);

    const result = await listMyChatGroups(USER_A, { timezoneOffset: 0 });

    expect(mockDbInsert).toHaveBeenCalled(); // the backfill actually wrote the chat + membership
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Phở Fan');
  });

  it('is unread from meal activity alone, with no messages at all', async () => {
    friendsBackfillQuery([]);
    myGroupsQuery([
      {
        id: GROUP_ID,
        kind: 'group',
        name: 'Trip',
        avatarSeed: null,
        updatedAt: new Date('2026-01-01T01:00:00Z'),
        lastReadAt: new Date('2026-01-01T00:00:00Z'),
        unread: true,
      },
    ]);
    lastMessagesQuery([]);
    lastMealSharesQuery([
      { groupId: GROUP_ID, lastSharedAt: new Date('2026-01-01T02:00:00Z') }, // after lastReadAt
    ]);

    const [entry] = await listMyChatGroups(USER_A, { timezoneOffset: 0 });

    expect(entry.unread).toBe(true);
  });

  it('sorts by the more-recent of message activity or meal activity, not just chatGroups.updatedAt', async () => {
    friendsBackfillQuery([]);
    // "Trip" has an OLDER chatGroups.updatedAt than "Roommates", but a
    // meal was shared in it more recently than anything in "Roommates" —
    // it should still sort first.
    myGroupsQuery([
      {
        id: DIRECT_GROUP_ID,
        kind: 'group',
        name: 'Roommates',
        avatarSeed: null,
        updatedAt: new Date('2026-01-05T00:00:00Z'),
        lastReadAt: new Date('2026-01-01T00:00:00Z'),
        unread: false,
      },
      {
        id: GROUP_ID,
        kind: 'group',
        name: 'Trip',
        avatarSeed: null,
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        lastReadAt: new Date('2026-01-01T00:00:00Z'),
        unread: false,
      },
    ]);
    lastMessagesQuery([]);
    lastMealSharesQuery([
      { groupId: GROUP_ID, lastSharedAt: new Date('2026-01-10T00:00:00Z') },
    ]);

    const result = await listMyChatGroups(USER_A, { timezoneOffset: 0 });

    expect(result.map((r) => r.title)).toEqual(['Trip', 'Roommates']);
  });
});

describe('listGroupMealFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // requireMembership: db.select().from().where().limit().
  function membershipQuery(rows: unknown[]) {
    mockDbSelect.mockReturnValueOnce(
      selectRows(
        rows.length > 0 ? [accessRow(rows[0] as Record<string, unknown>)] : []
      )
    );
  }

  // sharedGroupMealsBefore: four joins, then seek/order/limit.
  function sharedMealsBeforeQuery(rows: unknown[]) {
    const boundedRows = rows.map((row) => ({
      ...(row as Record<string, unknown>),
      ownerJoinedAt: new Date('2020-01-01T00:00:00.000Z'),
      visibilitySharedAt: (row as { sharedAt?: Date }).sharedAt,
    }));
    const query = {
      innerJoin: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(),
      limit: vi.fn().mockResolvedValue(boundedRows),
    };
    query.innerJoin.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.orderBy.mockReturnValue(query);
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue(query),
    });
  }

  function sharedMeal(index: number, sharedAt: Date) {
    return {
      friendUserId: USER_B,
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

  it('rejects a non-member', async () => {
    membershipQuery([]);

    await expect(
      listGroupMealFeed(USER_A, { groupId: GROUP_ID })
    ).rejects.toThrow('Không tìm thấy nhóm chat.');
  });

  it('returns every shared meal among members, not collapsed per person', async () => {
    const marker: { set?: unknown } = {};
    membershipQuery([{ id: 'member-row' }]);
    sharedMealsBeforeQuery([
      sharedMeal(2, new Date('2026-01-01T18:00:00Z')),
      sharedMeal(1, new Date('2026-01-01T08:00:00Z')),
    ]);
    stubUpdate(marker);

    const page = await listGroupMealFeed(USER_A, { groupId: GROUP_ID });

    expect(page.entries).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(marker.set)).toContain('2026-01-01T18:00:00.000Z');
    expect(JSON.stringify(marker.set)).toContain('GREATEST');
  });

  it('reports a nextCursor when more history remains', async () => {
    membershipQuery([{ id: 'member-row' }]);
    const rows = Array.from({ length: 21 }, (_, i) =>
      sharedMeal(i, new Date(Date.UTC(2026, 0, 21 - i)))
    );
    sharedMealsBeforeQuery(rows);
    stubUpdate(); // page 1 bumps lastReadAt

    const page = await listGroupMealFeed(USER_A, { groupId: GROUP_ID });

    expect(page.entries).toHaveLength(20);
    expect(page.nextCursor).not.toBeNull();
  });

  it('does not bump lastReadAt for an empty first page', async () => {
    membershipQuery([{ id: 'member-row' }]);
    sharedMealsBeforeQuery([]);
    stubUpdate();

    await listGroupMealFeed(USER_A, { groupId: GROUP_ID });

    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('does not bump lastReadAt when paginating with a `before` cursor', async () => {
    membershipQuery([{ id: 'member-row' }]);
    sharedMealsBeforeQuery([]);

    await listGroupMealFeed(USER_A, {
      groupId: GROUP_ID,
      before: '2026-01-01T00:00:00.000Z',
    });

    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('does not advance lastReadAt when reaction enrichment fails', async () => {
    membershipQuery([{ id: 'member-row' }]);
    sharedMealsBeforeQuery([
      sharedMeal(1, new Date('2026-01-01T18:00:00.000Z')),
    ]);
    vi.mocked(reactionsForShares).mockRejectedValueOnce(
      new Error('reaction read failed')
    );

    await expect(
      listGroupMealFeed(USER_A, { groupId: GROUP_ID })
    ).rejects.toThrow('reaction read failed');
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });
});

describe('membership-gated reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getChatGroup rejects a non-member', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([])); // no membership row

    await expect(getChatGroup(USER_A, { groupId: GROUP_ID })).rejects.toThrow(
      'Không tìm thấy nhóm chat.'
    );
  });

  it('listChatGroupMessages rejects a non-member', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([]));

    await expect(
      listChatGroupMessages(USER_A, { groupId: GROUP_ID })
    ).rejects.toThrow('Không tìm thấy nhóm chat.');
  });

  it('sendChatGroupMessage rejects a non-member', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([]));

    await expect(
      sendChatGroupMessage(USER_A, { groupId: GROUP_ID, body: 'hi' })
    ).rejects.toThrow('Không tìm thấy nhóm chat.');
  });

  it('listChatGroupMessages returns rows oldest-first and bumps the read marker', async () => {
    mockDbSelect
      .mockReturnValueOnce(selectRows([accessRow()]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'm2',
                  groupId: GROUP_ID,
                  senderId: USER_B,
                  body: 'second',
                  createdAt: new Date('2026-01-01T00:01:00Z'),
                },
                {
                  id: 'm1',
                  groupId: GROUP_ID,
                  senderId: USER_A,
                  body: 'first',
                  createdAt: new Date('2026-01-01T00:00:00Z'),
                },
              ]),
            }),
          }),
        }),
      });
    stubUpdate();

    const messages = await listChatGroupMessages(USER_A, { groupId: GROUP_ID });

    expect(messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
  });

  it('direct chat: a removed/blocked ex-friend is rejected despite membership', async () => {
    // Membership row still exists (remove/block only mutates friendships) but
    // the pair no longer has an accepted edge — the gate must 404, not serve.
    mockDbSelect.mockReturnValueOnce(
      selectRows([
        accessRow({
          kind: 'direct',
          directUserLow: LOW,
          directUserHigh: HIGH,
          directFriendAccepted: false,
        }),
      ])
    );

    await expect(
      sendChatGroupMessage(USER_A, { groupId: DIRECT_GROUP_ID, body: 'hi' })
    ).rejects.toThrow('Không tìm thấy nhóm chat.');
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('direct chat: a current accepted friend passes the gate', async () => {
    mockDbSelect.mockReturnValueOnce(
      selectRows([
        accessRow({
          kind: 'direct',
          directUserLow: LOW,
          directUserHigh: HIGH,
        }),
      ])
    );
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'm1',
            groupId: DIRECT_GROUP_ID,
            senderId: USER_A,
            body: 'hi',
            createdAt: new Date('2026-01-01T00:00:00Z'),
          },
        ]),
      }),
    });
    stubUpdate();

    const message = await sendChatGroupMessage(USER_A, {
      groupId: DIRECT_GROUP_ID,
      body: 'hi',
    });
    expect(message.body).toBe('hi');
  });

  it('sendChatGroupMessage bumps the group activity timestamp', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([accessRow()]));
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'm1',
            groupId: GROUP_ID,
            senderId: USER_A,
            body: 'hi',
            createdAt: new Date('2026-01-01T00:00:00Z'),
          },
        ]),
      }),
    });
    stubUpdate();

    const message = await sendChatGroupMessage(USER_A, {
      groupId: GROUP_ID,
      body: 'hi',
    });

    expect(message.body).toBe('hi');
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('leaveChatGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbTransaction.mockImplementation((fn: (tx: typeof mockTx) => unknown) =>
      fn(mockTx)
    );
  });

  function queueTxSelect(rows: unknown[], locked = false) {
    const limitResult = locked
      ? Object.assign(Promise.resolve(rows), {
          for: vi.fn().mockResolvedValue(rows),
        })
      : Promise.resolve(rows);
    const query = {
      innerJoin: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockReturnValue(limitResult),
    };
    query.innerJoin.mockReturnValue(query);
    query.where.mockReturnValue(query);
    mockTxSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue(query),
    });
  }

  it('rejects a malformed group id before opening a transaction', async () => {
    await expect(leaveChatGroup(USER_A, 'not-a-uuid')).rejects.toThrow();
    expect(mockDbTransaction).not.toHaveBeenCalled();
  });

  it('refuses to orphan a group while the owner has other members', async () => {
    queueTxSelect([{ id: GROUP_ID, kind: 'group' }], true);
    queueTxSelect(
      [
        {
          kind: 'group',
          role: 'owner',
          joinedAt: new Date('2020-01-01T00:00:00.000Z'),
          directUserLow: null,
          directUserHigh: null,
          directFriendAccepted: true,
        },
      ],
      true
    );
    queueTxSelect([{ id: 'other-member' }]);

    await expect(leaveChatGroup(USER_A, GROUP_ID)).rejects.toThrow(
      'Chủ nhóm không thể rời'
    );
    expect(mockTxDelete).not.toHaveBeenCalled();
  });

  it('removes a member so the next feed read fails membership', async () => {
    queueTxSelect([{ id: GROUP_ID, kind: 'group' }], true);
    queueTxSelect(
      [
        {
          kind: 'group',
          role: 'member',
          joinedAt: new Date('2020-01-01T00:00:00.000Z'),
          directUserLow: null,
          directUserHigh: null,
          directFriendAccepted: true,
        },
      ],
      true
    );
    mockTxDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    await expect(leaveChatGroup(USER_A, GROUP_ID)).resolves.toEqual({
      left: true,
    });
    expect(mockTxDelete).toHaveBeenCalledTimes(1);

    mockDbSelect.mockReturnValueOnce(selectRows([]));
    await expect(
      listGroupMealFeed(USER_A, { groupId: GROUP_ID })
    ).rejects.toThrow('Không tìm thấy nhóm chat.');
  });
});
