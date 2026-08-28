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

const {
  mockUser,
  mockCanViewShare,
  mockTxDelete,
  mockTxInsert,
  mockTxSelect,
  mockTx,
} = vi.hoisted(() => {
  const mockTxDelete = vi.fn();
  const mockTxInsert = vi.fn();
  const mockTxSelect = vi.fn();
  return {
    mockUser: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
    mockCanViewShare: vi.fn(),
    mockTxDelete,
    mockTxInsert,
    mockTxSelect,
    mockTx: {
      delete: mockTxDelete,
      insert: mockTxInsert,
      select: mockTxSelect,
    },
  };
});

vi.mock('@/lib/infra/auth/session', () => ({
  requireAuthAndProfile: vi.fn().mockResolvedValue({
    user: mockUser,
    profile: {},
  }),
}));
vi.mock('@/lib/infra/db/client', () => ({
  db: {
    transaction: vi.fn((run: (tx: typeof mockTx) => Promise<unknown>) =>
      run(mockTx)
    ),
  },
}));
vi.mock('@/lib/domain/social/shares/share-visibility', () => ({
  canViewShareOwnedBy: mockCanViewShare,
}));

import { toggleShareReactionAction } from '@/lib/actions/meal-sharing/reactions';

const SHARE_ID = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';

function deleteReturning(rows: unknown[]) {
  mockTxDelete.mockReturnValue({
    where: vi.fn(() => ({
      returning: vi.fn().mockResolvedValue(rows),
    })),
  });
}

function insertReturning(rows: unknown[]) {
  mockTxInsert.mockReturnValue({
    values: vi.fn(() => ({
      onConflictDoNothing: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue(rows),
      })),
    })),
  });
}

// The first select in the action is the FOR UPDATE lock on the share row;
// queue it as the one-shot so the default summary mock serves the second call.
function lockShare(
  rows: unknown[] = [
    {
      id: SHARE_ID,
      actorId: 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22',
      sharedAt: new Date('2026-07-18T00:00:00.000Z'),
      visibility: 'circle',
    },
  ]
) {
  mockTxSelect.mockReturnValueOnce({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        for: vi.fn().mockResolvedValue(rows),
      })),
    })),
  });
}

function summary(rows: unknown[]) {
  mockTxSelect.mockReturnValue({
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(rows),
    })),
  });
}

describe('toggleShareReactionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanViewShare.mockResolvedValue(true);
  });

  it('inserts the v1 heart and returns the final summary', async () => {
    lockShare();
    deleteReturning([]);
    insertReturning([{ id: 'reaction' }]);
    summary([{ count: 3, mine: true }]);

    await expect(
      toggleShareReactionAction({ shareId: SHARE_ID })
    ).resolves.toEqual({ reacted: true, count: 3 });
  });

  it('deletes an existing reaction without attempting an insert', async () => {
    lockShare();
    deleteReturning([{ id: 'reaction' }]);
    summary([{ count: 2, mine: false }]);

    await expect(
      toggleShareReactionAction({ shareId: SHARE_ID })
    ).resolves.toEqual({ reacted: false, count: 2 });
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('reports the row that won a concurrent unique-conflict insert', async () => {
    lockShare();
    deleteReturning([]);
    insertReturning([]);
    summary([{ count: 1, mine: true }]);

    await expect(
      toggleShareReactionAction({ shareId: SHARE_ID })
    ).resolves.toEqual({ reacted: true, count: 1 });
  });

  it('notifies the meal owner when the heart goes on', async () => {
    const OWNER = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';
    lockShare([
      {
        id: SHARE_ID,
        actorId: OWNER,
        sharedAt: new Date('2026-07-18T00:00:00.000Z'),
        visibility: 'circle',
      },
    ]);
    deleteReturning([]);
    insertReturning([{ id: 'reaction' }]);
    summary([{ count: 1, mine: true }]);

    await toggleShareReactionAction({ shareId: SHARE_ID });

    expect(mockNotify.mock.lastCall?.[1]).toEqual([
      {
        recipientId: OWNER,
        type: 'share.reaction',
        actorId: mockUser.id,
        objectType: 'share',
        objectId: SHARE_ID,
        groupKey: `share.reaction:${SHARE_ID}`,
      },
    ]);
    expect(mockRetractActor).not.toHaveBeenCalled();
  });

  it('schedules a push when the heart goes on, and none when it comes off', async () => {
    const OWNER = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';
    lockShare([
      {
        id: SHARE_ID,
        actorId: OWNER,
        sharedAt: new Date('2026-07-18T00:00:00.000Z'),
        visibility: 'circle',
      },
    ]);
    deleteReturning([]);
    insertReturning([{ id: 'reaction' }]);
    summary([{ count: 1, mine: true }]);
    mockNotify.mockResolvedValueOnce([OWNER]);

    await toggleShareReactionAction({ shareId: SHARE_ID });

    expect(mockSendNotificationPush).toHaveBeenCalledWith([OWNER], {
      type: 'share.reaction',
      actorId: mockUser.id,
      groupKey: `share.reaction:${SHARE_ID}`,
    });

    // Un-reacting: after() still fires (it is unconditional), but with the
    // empty recipient list a retract produced — nobody is pushed.
    mockSendNotificationPush.mockClear();
    lockShare([
      {
        id: SHARE_ID,
        actorId: OWNER,
        sharedAt: new Date('2026-07-18T00:00:00.000Z'),
        visibility: 'circle',
      },
    ]);
    deleteReturning([{ id: 'reaction' }]);
    summary([{ count: 0, mine: false }]);

    await toggleShareReactionAction({ shareId: SHARE_ID });

    expect(mockSendNotificationPush).toHaveBeenCalledWith(
      [],
      expect.anything()
    );
  });

  it('retracts the actor from the open aggregate when the heart comes off', async () => {
    const OWNER = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';
    lockShare([
      {
        id: SHARE_ID,
        actorId: OWNER,
        sharedAt: new Date('2026-07-18T00:00:00.000Z'),
        visibility: 'circle',
      },
    ]);
    deleteReturning([{ id: 'reaction' }]);
    summary([{ count: 0, mine: false }]);

    await toggleShareReactionAction({ shareId: SHARE_ID });

    expect(mockRetractActor.mock.lastCall?.[1]).toEqual({
      recipientId: OWNER,
      groupKey: `share.reaction:${SHARE_ID}`,
      actorId: mockUser.id,
    });
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('rejects an unauthorized share before any mutation', async () => {
    lockShare();
    mockCanViewShare.mockResolvedValue(false);

    await expect(
      toggleShareReactionAction({ shareId: SHARE_ID })
    ).rejects.toThrow('Không tìm thấy bài chia sẻ.');
    expect(mockTxDelete).not.toHaveBeenCalled();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('returns not found before visibility checks when the share is missing', async () => {
    lockShare([]);

    await expect(
      toggleShareReactionAction({ shareId: SHARE_ID })
    ).rejects.toThrow('Không tìm thấy bài chia sẻ.');
    expect(mockCanViewShare).not.toHaveBeenCalled();
    expect(mockTxDelete).not.toHaveBeenCalled();
  });
});
