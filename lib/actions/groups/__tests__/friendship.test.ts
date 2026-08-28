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
// acceptInvite opens. They are distinct mocks so the profile lookup (db.select)
// never collides with the in-transaction friendship lookup (tx.select).

const {
  mockDbSelect,
  mockDbInsert,
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
    mockDbInsert: vi.fn(),
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
