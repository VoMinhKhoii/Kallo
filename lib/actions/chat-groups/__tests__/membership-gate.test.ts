import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// `db.*` is the app singleton (owner role); `tx.*` is the transaction handle
// leaveChatGroup opens. Every entry point below is gated by the same
// requireGroupAccess read, so they are exercised together.

const {
  mockDbSelect,
  mockDbInsert,
  mockDbUpdate,
  mockDbTransaction,
  mockTxSelect,
  mockTxDelete,
  mockTx,
} = vi.hoisted(() => {
  const mockTxSelect = vi.fn();
  const mockTxDelete = vi.fn();
  return {
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbTransaction: vi.fn(),
    mockTxSelect,
    mockTxDelete,
    mockTx: {
      select: mockTxSelect,
      delete: mockTxDelete,
    },
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    transaction: mockDbTransaction,
  },
}));

vi.mock('drizzle-orm/pg-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm/pg-core')>();
  return { ...actual, alias: (table: unknown) => table };
});

vi.mock('@/lib/db/schema', async () => await import('./schema-doubles'));

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
// Modules under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import { getChatGroup } from '@/lib/actions/chat-groups/details';
import { listGroupMealFeed } from '@/lib/actions/chat-groups/feed';
import { leaveChatGroup } from '@/lib/actions/chat-groups/membership';
import {
  listChatGroupMessages,
  sendChatGroupMessage,
} from '@/lib/actions/chat-groups/messages';

const USER_A = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const USER_B = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
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
function stubUpdate() {
  mockDbUpdate.mockReturnValue({
    set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
  });
}

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
