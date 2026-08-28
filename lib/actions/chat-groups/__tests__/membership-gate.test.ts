import { beforeEach, describe, expect, it, vi } from 'vitest';

// Push (Phase 4) rides on next/server's `after()`, which needs a request scope
// these unit suites don't have. The double runs the callback inline so the
// scheduling itself is assertable; what the push then does is covered by
// lib/domain/notifications/__tests__/push.test.ts.
const { mockAfter, mockSendNotificationPush, mockSendChatMessagePush } =
  vi.hoisted(() => ({
    mockAfter: vi.fn((task: () => unknown) => {
      void task();
    }),
    mockSendNotificationPush: vi.fn(async (): Promise<void> => undefined),
    mockSendChatMessagePush: vi.fn(async (): Promise<void> => undefined),
  }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  after: mockAfter,
}));
vi.mock('@/lib/domain/notifications/push', () => ({
  sendNotificationPush: mockSendNotificationPush,
  sendChatMessagePush: mockSendChatMessagePush,
}));

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

import type { FeatureLockedError } from '@/lib/core/errors/app-error';
import { Errors } from '@/lib/core/errors/catalog';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// `db.*` is the app singleton (owner role); `tx.*` is the transaction handle
// leaveChatGroup opens. Every entry point below is gated by the same
// requireGroupAccess read, so they are exercised together.

const {
  mockDbSelect,
  mockDbUpdate,
  mockDbTransaction,
  mockTxSelect,
  mockTxInsert,
  mockTxUpdate,
  mockTxDelete,
  mockTx,
} = vi.hoisted(() => {
  const mockTxSelect = vi.fn();
  const mockTxInsert = vi.fn();
  const mockTxUpdate = vi.fn();
  const mockTxDelete = vi.fn();
  return {
    mockDbSelect: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbTransaction: vi.fn(),
    mockTxSelect,
    mockTxInsert,
    mockTxUpdate,
    mockTxDelete,
    mockTx: {
      select: mockTxSelect,
      insert: mockTxInsert,
      update: mockTxUpdate,
      delete: mockTxDelete,
    },
  };
});

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
    transaction: mockDbTransaction,
  },
}));

vi.mock('drizzle-orm/pg-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm/pg-core')>();
  return { ...actual, alias: (table: unknown) => table };
});

vi.mock('@/lib/infra/db/schema', async () => await import('./schema-doubles'));

// The premium circle gate is a pure pass-through here unless a test makes it
// throw — explicit so the suite never depends on the enforcement env var.
const { mockAssertActor } = vi.hoisted(() => ({
  mockAssertActor: vi.fn(async (..._args: unknown[]) => undefined),
}));
vi.mock('@/lib/domain/social/quota/circle-quota', () => ({
  assertUnlimitedCircleActor: mockAssertActor,
  assertGroupCapacity: vi.fn(async () => undefined),
}));

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

// A stub update chain: update(table).set(vals).where(cond) -> resolves.
function stubUpdate() {
  mockDbUpdate.mockReturnValue({
    set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
  });
}

// The whole send write: the activity bump, the message insert and the push
// audience are ONE transaction, in that order — the bump takes the
// chat_groups write lock before the message exists, so a concurrent join
// cannot slip between the write and the audience capture.
function stubSendTx(message: Record<string, unknown>, memberIds: string[]) {
  mockTxUpdate.mockReturnValueOnce({
    set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
  });
  mockTxInsert.mockReturnValueOnce({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([message]),
    }),
  });
  mockTxSelect.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(memberIds.map((userId) => ({ userId }))),
    }),
  });
}

function sentMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    groupId: GROUP_ID,
    senderId: USER_A,
    body: 'hi',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('membership-gated reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbTransaction.mockImplementation((fn: (tx: typeof mockTx) => unknown) =>
      fn(mockTx)
    );
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
    expect(mockDbTransaction).not.toHaveBeenCalled();
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
    stubSendTx(sentMessage({ groupId: DIRECT_GROUP_ID }), [USER_B]);

    const message = await sendChatGroupMessage(USER_A, {
      groupId: DIRECT_GROUP_ID,
      body: 'hi',
    });
    expect(message.body).toBe('hi');
  });

  it('sendChatGroupMessage bumps the group activity timestamp', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([accessRow()]));
    stubSendTx(sentMessage(), [USER_B]);

    const message = await sendChatGroupMessage(USER_A, {
      groupId: GROUP_ID,
      body: 'hi',
    });

    expect(message.body).toBe('hi');
    // The bump rides inside the send transaction, not on the db singleton.
    expect(mockTxUpdate).toHaveBeenCalledTimes(1);
    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(mockAssertActor).toHaveBeenCalledWith(expect.anything(), USER_A);
  });

  // Chat is the one producer that pushes WITHOUT writing a notification row —
  // chat_group_members.lastReadAt already carries the unread state (Gate 3).
  it('sendChatGroupMessage pushes without creating a notification row', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([accessRow()]));
    stubSendTx(sentMessage({ body: 'Ăn cơm chưa' }), [USER_B]);

    await sendChatGroupMessage(USER_A, {
      groupId: GROUP_ID,
      body: 'Ăn cơm chưa',
    });

    expect(mockNotify).not.toHaveBeenCalled();
    expect(mockAfter).toHaveBeenCalledTimes(1);
    // The audience is resolved HERE, in the write's scope — not inside the
    // after() callback, where a member who joined in between would be handed a
    // preview of a message sent before they were in the room.
    expect(mockSendChatMessagePush).toHaveBeenCalledWith({
      groupId: GROUP_ID,
      senderId: USER_A,
      preview: 'Ăn cơm chưa',
      recipientIds: [USER_B],
    });
    expect(
      mockTxSelect.mock.invocationCallOrder.at(-1) ?? Number.POSITIVE_INFINITY
    ).toBeLessThan(mockAfter.mock.invocationCallOrder[0]);
  });

  // The race this closes: a member joining between the message write and the
  // audience read would be pushed a preview of a message sent before they were
  // in the room. All three statements share one transaction, and the
  // chat_groups bump takes that row's write lock FIRST — the same lock every
  // membership change opens with — so no join can interleave.
  it('sendChatGroupMessage captures the audience inside the write transaction', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([accessRow()]));
    stubSendTx(sentMessage(), [USER_B]);

    await sendChatGroupMessage(USER_A, { groupId: GROUP_ID, body: 'hi' });

    expect(mockDbTransaction).toHaveBeenCalledTimes(1);
    // Bump (lock) -> insert -> audience, all on the transaction handle.
    const bump = mockTxUpdate.mock.invocationCallOrder[0];
    const insert = mockTxInsert.mock.invocationCallOrder[0];
    const audience = mockTxSelect.mock.invocationCallOrder[0];
    expect(bump).toBeLessThan(insert);
    expect(insert).toBeLessThan(audience);
  });

  it('does NOT gate a direct 1:1 send (direct chat stays free)', async () => {
    mockDbSelect.mockReturnValueOnce(
      selectRows([
        accessRow({
          kind: 'direct',
          directUserLow: LOW,
          directUserHigh: HIGH,
        }),
      ])
    );
    stubSendTx(sentMessage({ groupId: DIRECT_GROUP_ID }), [USER_B]);

    await sendChatGroupMessage(USER_A, {
      groupId: DIRECT_GROUP_ID,
      body: 'hi',
    });
    expect(mockAssertActor).not.toHaveBeenCalled();
  });

  it('propagates a 402 from the group gate before inserting', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([accessRow()]));
    mockAssertActor.mockRejectedValueOnce(
      Errors.featureLocked('unlimited_circle', 'not_entitled')
    );

    const error = await sendChatGroupMessage(USER_A, {
      groupId: GROUP_ID,
      body: 'hi',
    }).catch((e: unknown) => e);

    expect((error as FeatureLockedError).status).toBe(402);
    expect(mockDbTransaction).not.toHaveBeenCalled();
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
