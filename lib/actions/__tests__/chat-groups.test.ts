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
  mockTx,
} = vi.hoisted(() => {
  const mockTxInsert = vi.fn();
  return {
    mockDbSelect: vi.fn(),
    mockDbSelectDistinctOn: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbTransaction: vi.fn(),
    mockTxInsert,
    mockTx: { insert: mockTxInsert },
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
  },
  chatGroupMessages: {
    id: 'cgmsg.id',
    groupId: 'cgmsg.groupId',
    senderId: 'cgmsg.senderId',
    body: 'cgmsg.body',
    createdAt: 'cgmsg.createdAt',
  },
  friendships: {
    status: 'f.status',
    userLow: 'f.userLow',
    userHigh: 'f.userHigh',
  },
  publicProfiles: {
    userId: 'pp.userId',
    handle: 'pp.handle',
    displayName: 'pp.displayName',
    avatarSeed: 'pp.avatarSeed',
  },
}));

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import {
  createChatGroup,
  getChatGroup,
  getOrCreateDirectChatGroup,
  listChatGroupMessages,
  listMyChatGroups,
  sendChatGroupMessage,
} from '@/lib/actions/chat-groups';

const USER_A = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const USER_B = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const USER_C = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const GROUP_ID = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';
const DIRECT_GROUP_ID = 'e4ccef33-df4f-4cc2-af0f-0ffdf0724e55';
const [LOW, HIGH] = USER_A < USER_B ? [USER_A, USER_B] : [USER_B, USER_A];

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

// A stub update chain: db.update(table).set(vals).where(cond) -> resolves.
function stubUpdate() {
  mockDbUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
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
    mockDbSelect.mockReturnValueOnce(selectRows([])); // no friendship edge

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
    mockDbSelect
      .mockReturnValueOnce(selectRows([{ status: 'accepted' }])) // USER_B
      .mockReturnValueOnce(selectRows([{ status: 'accepted' }])); // USER_C

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
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
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
      },
    ]);
    lastMessagesQuery([
      {
        groupId: GROUP_ID,
        body: 'See you there!',
        createdAt: new Date('2026-01-01T00:30:00Z'), // after lastReadAt
      },
    ]);

    const [entry] = await listMyChatGroups(USER_A);

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
      },
    ]);
    lastMessagesQuery([
      {
        groupId: GROUP_ID,
        body: 'See you there!',
        createdAt: new Date('2026-01-01T00:30:00Z'), // before lastReadAt
      },
    ]);

    const [entry] = await listMyChatGroups(USER_A);

    expect(entry.unread).toBe(false);
  });

  it('resolves a direct chat title to the OTHER member, not the actor', async () => {
    friendsBackfillQuery([]);
    myGroupsQuery([
      {
        id: DIRECT_GROUP_ID,
        kind: 'direct',
        name: null,
        avatarSeed: null,
        updatedAt: new Date('2026-01-01T01:00:00Z'),
        lastReadAt: new Date('2026-01-01T01:00:00Z'),
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

    const [entry] = await listMyChatGroups(USER_A);

    expect(entry.title).toBe('Phở Fan');
    expect(entry.lastMessagePreview).toBeNull();
    expect(entry.unread).toBe(false);
  });

  it('backfills a direct chat for an accepted friend who never got one, so they still show up', async () => {
    // One accepted friend with no existing chat_groups row for the pair.
    friendsBackfillQuery([{ userLow: USER_A, userHigh: USER_B }]);
    // getOrCreateDirectChatGroup's own inserts, invoked by the backfill.
    mockDbInsert.mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    }));
    // getOrCreateDirectChatGroup's re-select of the (newly created) group id.
    mockDbSelect.mockReturnValueOnce(selectRows([{ id: DIRECT_GROUP_ID }]));

    myGroupsQuery([
      {
        id: DIRECT_GROUP_ID,
        kind: 'direct',
        name: null,
        avatarSeed: null,
        updatedAt: new Date('2026-01-01T01:00:00Z'),
        lastReadAt: new Date('2026-01-01T01:00:00Z'),
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

    const result = await listMyChatGroups(USER_A);

    expect(mockDbInsert).toHaveBeenCalled(); // the backfill actually wrote the chat + membership
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Phở Fan');
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
      .mockReturnValueOnce(selectRows([{ id: 'member-row' }])) // membership ok
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

  it('sendChatGroupMessage bumps the group activity timestamp', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([{ id: 'member-row' }])); // membership ok
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
