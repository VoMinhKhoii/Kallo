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

import { Errors } from '@/lib/core/errors/catalog';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// `db.*` is the app singleton (owner role); `tx.*` is the transaction handle
// acceptInvite opens. They are distinct mocks so the profile lookup (db.select)
// never collides with the in-transaction friendship lookup (tx.select).

const {
  mockDbSelect,
  mockDbInsert,
  mockDbDelete,
  mockTxSelect,
  mockTxInsert,
  mockTxUpdate,
  mockTxExecute,
  mockTx,
} = vi.hoisted(() => {
  const mockTxSelect = vi.fn();
  const mockTxInsert = vi.fn();
  const mockTxUpdate = vi.fn();
  // acceptInvite's two raw statements, in order: the pair lock, then the
  // user_blocks check. Both answer "nothing" unless a case says otherwise.
  const mockTxExecute = vi.fn(async (..._args: unknown[]) => [] as unknown[]);
  return {
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbDelete: vi.fn(),
    mockTxSelect,
    mockTxInsert,
    mockTxUpdate,
    mockTxExecute,
    mockTx: {
      select: mockTxSelect,
      insert: mockTxInsert,
      update: mockTxUpdate,
      execute: mockTxExecute,
    },
  };
});

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    delete: mockDbDelete,
    transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx)
    ),
  },
}));

vi.mock(
  '@/lib/infra/db/schema',
  async () => (await import('./circle-doubles')).schema
);

// The free-tier friend cap: pass-through unless a test arms it, so the suite
// never depends on the BILLING_ENFORCEMENT_ENABLED env var.
const { mockAssertFriendCapacity } = vi.hoisted(() => ({
  mockAssertFriendCapacity: vi.fn(async (..._args: unknown[]) => undefined),
}));
vi.mock('@/lib/domain/social/quota/circle-quota', () => ({
  assertFriendCapacity: mockAssertFriendCapacity,
}));

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import { acceptInvite, removeFriend } from '@/lib/actions/groups/friendship';
import {
  ACTOR,
  DIRECT_GROUP_ID,
  FRIENDSHIP_ID,
  INVITER,
  inviterProfile,
  inviterRow,
  SLUG,
  selectRows,
  txSelect,
} from './circle-doubles';

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
    // accepted_at is the DB trigger's to stamp at the status flip (KALLO-03):
    // an app-clock value would not compare cleanly with shared_at.
    expect(friendship).not.toHaveProperty('acceptedAt');

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
    const set = vi
      .fn()
      .mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockTxUpdate.mockReturnValue({ set });
    const inserts = captureInserts();

    const result = await acceptInvite(ACTOR, { slug: SLUG });

    expect(result.status).toBe('accepted');
    expect(mockTxUpdate).toHaveBeenCalledTimes(1);
    // The promote leaves accepted_at to the DB trigger, which stamps it at
    // this status flip (KALLO-03).
    const promoted = set.mock.calls[0][0] as Record<string, unknown>;
    expect(promoted.status).toBe('accepted');
    expect(promoted).not.toHaveProperty('acceptedAt');
    // event + chat_groups + chat_group_members
    expect(mockTxInsert).toHaveBeenCalledTimes(3);
    expect(inserts[0]?.type).toBe('friend_accepted');
    expect(inserts[0]?.refId).toBe(FRIENDSHIP_ID);
    expect(inserts.find((v) => v.kind === 'direct')).toMatchObject({
      directUserLow: ACTOR,
      directUserHigh: INVITER,
    });
  });

  it('tells the inviter their link landed on the promote path', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect
      .mockReturnValueOnce(txSelect([{ id: FRIENDSHIP_ID, status: 'pending' }]))
      .mockReturnValueOnce(txSelect([{ id: DIRECT_GROUP_ID }]));
    mockTxUpdate.mockReturnValue({
      set: vi
        .fn()
        .mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    captureInserts();

    await acceptInvite(ACTOR, { slug: SLUG });

    expect(mockNotify.mock.lastCall?.[1]).toEqual([
      {
        recipientId: INVITER,
        type: 'friend.joined',
        actorId: ACTOR,
        objectType: 'friendship',
        objectId: FRIENDSHIP_ID,
        groupKey: `friend.joined:${FRIENDSHIP_ID}`,
      },
    ]);
  });

  // Push is scheduled AFTER the transaction resolves — never from inside it,
  // where a later rollback would leave a phone buzzing about a friendship
  // that does not exist.
  it('schedules the inviter push once the edge is committed', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect
      .mockReturnValueOnce(txSelect([{ id: FRIENDSHIP_ID, status: 'pending' }]))
      .mockReturnValueOnce(txSelect([{ id: DIRECT_GROUP_ID }]));
    mockTxUpdate.mockReturnValue({
      set: vi
        .fn()
        .mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    captureInserts();
    mockNotify.mockResolvedValueOnce([INVITER]);

    await acceptInvite(ACTOR, { slug: SLUG });

    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockSendNotificationPush).toHaveBeenCalledWith([INVITER], {
      type: 'friend.joined',
      actor: { id: ACTOR },
      objectType: 'friendship',
      objectId: FRIENDSHIP_ID,
      groupKey: `friend.joined:${FRIENDSHIP_ID}`,
    });
  });

  // The writer that won the insert already notified — a second signal here
  // would double-badge the inviter for one join.
  it('stays silent on the race-reconcile path', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect
      .mockReturnValueOnce(txSelect([]))
      .mockReturnValueOnce(txSelect([{ status: 'accepted' }]))
      .mockReturnValueOnce(txSelect([{ id: DIRECT_GROUP_ID }]));
    insertConflicted();

    await acceptInvite(ACTOR, { slug: SLUG });

    expect(mockNotify).not.toHaveBeenCalled();
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

  it('checks both parties against the friend cap on a NEW edge', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect
      .mockReturnValueOnce(txSelect([]))
      .mockReturnValueOnce(txSelect([{ id: DIRECT_GROUP_ID }]));
    captureInserts();

    await acceptInvite(ACTOR, { slug: SLUG });

    expect(mockAssertFriendCapacity).toHaveBeenCalledWith(expect.anything(), {
      accepterId: ACTOR,
      inviterId: INVITER,
      inviterName: 'Phở Fan',
    });
  });

  it('does NOT check the friend cap when the edge is already accepted', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect.mockReturnValueOnce(
      txSelect([{ id: FRIENDSHIP_ID, status: 'accepted' }])
    );

    await acceptInvite(ACTOR, { slug: SLUG });

    expect(mockAssertFriendCapacity).not.toHaveBeenCalled();
  });

  it('propagates the accepter 402 without writing the edge', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect.mockReturnValueOnce(txSelect([]));
    captureInserts();
    mockAssertFriendCapacity.mockRejectedValueOnce(
      Errors.featureLocked('unlimited_circle', 'not_entitled')
    );

    await expect(acceptInvite(ACTOR, { slug: SLUG })).rejects.toMatchObject({
      status: 402,
      code: 'feature_locked',
    });
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('propagates a 409 when the inviter is at their friend cap', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect.mockReturnValueOnce(txSelect([]));
    captureInserts();
    mockAssertFriendCapacity.mockRejectedValueOnce(
      Errors.circleLimitReached('Phở Fan đã đạt giới hạn 10 bạn bè.')
    );

    await expect(acceptInvite(ACTOR, { slug: SLUG })).rejects.toMatchObject({
      status: 409,
      code: 'CIRCLE_LIMIT_REACHED',
    });
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

  // Blocks live in user_blocks, directed; accepting across one — in EITHER
  // direction — is refused before the edge is even read, under the pair lock
  // blockFriend also takes (so a block can't commit between check and write).
  it('refuses to connect when either person blocked the other', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxExecute
      .mockResolvedValueOnce([]) // pair lock
      .mockResolvedValueOnce([{ blocked: true }]); // user_blocks check

    await expect(acceptInvite(ACTOR, { slug: SLUG })).rejects.toThrow(
      'Không thể kết nối.'
    );
    expect(mockTxExecute).toHaveBeenCalledTimes(2);
    expect(mockTxSelect).not.toHaveBeenCalled();
    expect(mockTxInsert).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('takes the pair lock before the block check and the edge read', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect.mockReturnValueOnce(
      txSelect([{ id: FRIENDSHIP_ID, status: 'accepted' }])
    );

    await acceptInvite(ACTOR, { slug: SLUG });

    const { PgDialect } = await import('drizzle-orm/pg-core');
    const lock = new PgDialect().sqlToQuery(
      mockTxExecute.mock.calls[0]?.[0] as never
    );
    expect(lock.sql).toContain('pg_advisory_xact_lock');
    const [low, high] = ACTOR < INVITER ? [ACTOR, INVITER] : [INVITER, ACTOR];
    expect(lock.params).toEqual([`friend-pair:${low}:${high}`]);
    expect(mockTxExecute.mock.invocationCallOrder[1]).toBeLessThan(
      mockTxSelect.mock.invocationCallOrder[0]
    );
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
