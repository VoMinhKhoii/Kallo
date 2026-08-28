import { beforeEach, describe, expect, it, vi } from 'vitest';

// Notifications: this suite asserts WHO gets told; the helper's own upsert and
// retract semantics live in lib/domain/notifications/__tests__.
const { mockNotify, mockRetractActor } = vi.hoisted(() => ({
  mockNotify: vi.fn(async (..._args: unknown[]): Promise<string[]> => []),
  mockRetractActor: vi.fn(
    async (..._args: unknown[]): Promise<void> => undefined
  ),
}));
vi.mock('@/lib/domain/notifications/notify', () => ({
  notify: mockNotify,
  retractActor: mockRetractActor,
}));

import { Errors } from '@/lib/core/errors/catalog';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// `db.*` is the app singleton (owner role); `tx.*` is the transaction handle
// createChatGroup opens.

const {
  mockDbSelect,
  mockDbSelectDistinctOn,
  mockDbInsert,
  mockDbTransaction,
  mockTxInsert,
  mockTx,
} = vi.hoisted(() => {
  const mockTxInsert = vi.fn();
  return {
    mockDbSelect: vi.fn(),
    mockDbSelectDistinctOn: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbTransaction: vi.fn(),
    mockTxInsert,
    mockTx: { insert: mockTxInsert },
  };
});

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    select: mockDbSelect,
    selectDistinctOn: mockDbSelectDistinctOn,
    insert: mockDbInsert,
    transaction: mockDbTransaction,
  },
}));

vi.mock('drizzle-orm/pg-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm/pg-core')>();
  return { ...actual, alias: (table: unknown) => table };
});

vi.mock('@/lib/infra/db/schema', async () => await import('./schema-doubles'));

// Premium circle gates: pass-through unless a test arms one, so the suite
// never depends on the BILLING_ENFORCEMENT_ENABLED env var.
const { mockAssertActor, mockAssertCapacity } = vi.hoisted(() => ({
  mockAssertActor: vi.fn(async (..._args: unknown[]) => undefined),
  mockAssertCapacity: vi.fn(async (..._args: unknown[]) => undefined),
}));
vi.mock('@/lib/domain/social/quota/circle-quota', () => ({
  assertUnlimitedCircleActor: mockAssertActor,
  assertGroupCapacity: mockAssertCapacity,
}));

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import {
  createChatGroup,
  listMyChatGroups,
} from '@/lib/actions/chat-groups/create-and-list';

const USER_A = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const USER_B = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const USER_C = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const GROUP_ID = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';
const DIRECT_GROUP_ID = 'e4ccef33-df4f-4cc2-af0f-0ffdf0724e55';
const [LOW, HIGH] = USER_A < USER_B ? [USER_A, USER_B] : [USER_B, USER_A];

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
    expect(mockAssertActor).toHaveBeenCalledWith(expect.anything(), USER_A);
    expect(mockAssertCapacity.mock.lastCall?.[1]).toEqual([USER_B, USER_C]);
  });

  it('notifies every added member and never the creator', async () => {
    acceptedFriendsQuery([USER_B, USER_C]);
    mockTxInsert.mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: GROUP_ID }]),
      }),
    }));

    await createChatGroup(USER_A, {
      name: 'Trip',
      memberUserIds: [USER_B, USER_C],
    });

    const inputs = mockNotify.mock.lastCall?.[1] as {
      recipientId: string;
      type: string;
      actorId: string;
      targetId: string;
      data: unknown;
    }[];
    expect(inputs.map((input) => input.recipientId)).toEqual([USER_B, USER_C]);
    expect(inputs.every((input) => input.type === 'group.added')).toBe(true);
    expect(inputs.every((input) => input.actorId === USER_A)).toBe(true);
    expect(inputs[0]).toMatchObject({
      targetId: GROUP_ID,
      data: { groupName: 'Trip' },
    });
  });

  it('propagates the actor 402 without opening the transaction', async () => {
    acceptedFriendsQuery([USER_B]);
    mockAssertActor.mockRejectedValueOnce(
      Errors.featureLocked('unlimited_circle', 'not_entitled')
    );

    await expect(
      createChatGroup(USER_A, { name: 'Trip', memberUserIds: [USER_B] })
    ).rejects.toMatchObject({ status: 402, code: 'feature_locked' });
    expect(mockDbTransaction).not.toHaveBeenCalled();
  });

  it('propagates a 409 when an invited member is at their group cap', async () => {
    acceptedFriendsQuery([USER_B]);
    mockAssertCapacity.mockRejectedValueOnce(
      Errors.circleLimitReached('Phở Fan đã đạt giới hạn 2 nhóm.')
    );

    await expect(
      createChatGroup(USER_A, { name: 'Trip', memberUserIds: [USER_B] })
    ).rejects.toMatchObject({ status: 409, code: 'CIRCLE_LIMIT_REACHED' });
    expect(mockTxInsert).not.toHaveBeenCalled();
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
