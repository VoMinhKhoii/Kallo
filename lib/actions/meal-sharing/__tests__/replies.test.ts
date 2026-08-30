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
  mockTxInsert,
  mockTxSelect,
  mockTxSelectDistinct,
  mockTx,
} = vi.hoisted(() => {
  const mockTxInsert = vi.fn();
  const mockTxSelect = vi.fn();
  const mockTxSelectDistinct = vi.fn();
  return {
    mockUser: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
    mockCanViewShare: vi.fn(),
    mockTxInsert,
    mockTxSelect,
    mockTxSelectDistinct,
    mockTx: {
      insert: mockTxInsert,
      select: mockTxSelect,
      selectDistinct: mockTxSelectDistinct,
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

import { createShareReplyAction } from '@/lib/actions/meal-sharing/replies';

const SHARE_ID = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const REPLY_ID = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const CREATED_AT = new Date('2026-07-18T00:00:00.000Z');

function lockShare(
  rows: unknown[] = [
    {
      id: SHARE_ID,
      actorId: 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44',
      sharedAt: CREATED_AT,
      visibility: 'circle',
    },
  ]
) {
  const forUpdate = vi.fn().mockResolvedValue(rows);
  mockTxSelect.mockReturnValueOnce({
    from: vi.fn(() => ({
      where: vi.fn(() => ({ for: forUpdate })),
    })),
  });
  return forUpdate;
}

function selectRows(rows: unknown[]) {
  mockTxSelect.mockReturnValueOnce({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(rows),
      })),
    })),
  });
}

function insertReturning(
  rows: unknown[],
  capture?: { values?: Record<string, unknown>; target?: unknown }
) {
  mockTxInsert.mockReturnValue({
    values: vi.fn((values: Record<string, unknown>) => {
      if (capture) capture.values = values;
      return {
        onConflictDoNothing: vi.fn((config: { target: unknown }) => {
          if (capture) capture.target = config.target;
          return {
            returning: vi.fn().mockResolvedValue(rows),
          };
        }),
      };
    }),
  });
}

/** The distinct prior repliers on the share (the fan-out audience). */
function repliers(userIds: string[]) {
  mockTxSelectDistinct.mockReturnValue({
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(userIds.map((userId) => ({ userId }))),
    })),
  });
}

describe('createShareReplyAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanViewShare.mockResolvedValue(true);
    repliers([mockUser.id]);
  });

  it('locks and authorizes the share before inserting the client reply id', async () => {
    const forUpdate = lockShare();
    const capture: { values?: Record<string, unknown>; target?: unknown } = {};
    insertReturning(
      [
        {
          id: REPLY_ID,
          userId: mockUser.id,
          body: 'Ngon quá',
          createdAt: CREATED_AT,
        },
      ],
      capture
    );
    selectRows([
      {
        handle: 'pho-fan',
        displayName: 'Phở Fan',
        avatarSeed: 'pho-fan',
        avatarUrl: null,
      },
    ]);

    const reply = await createShareReplyAction({
      shareId: SHARE_ID,
      replyId: REPLY_ID,
      body: 'Ngon quá',
    });

    expect(reply).toMatchObject({ id: REPLY_ID, body: 'Ngon quá' });
    expect(capture.values).toMatchObject({ id: REPLY_ID, shareId: SHARE_ID });
    expect(forUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      mockCanViewShare.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
    expect(mockCanViewShare).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({ id: SHARE_ID }),
      mockTx
    );
  });

  it('fans out to the owner and prior repliers, minus the author, deduped', async () => {
    const OWNER = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';
    const OTHER_REPLIER = 'e4ccff33-d04f-4cc2-af01-affdf0724e55';
    lockShare();
    insertReturning([
      {
        id: REPLY_ID,
        userId: mockUser.id,
        body: 'Ngon quá',
        createdAt: CREATED_AT,
      },
    ]);
    // The owner has replied before, so they appear twice in the raw audience.
    repliers([OWNER, OTHER_REPLIER, mockUser.id]);
    selectRows([]);

    await createShareReplyAction({
      shareId: SHARE_ID,
      replyId: REPLY_ID,
      body: 'Ngon quá',
    });

    const inputs = mockNotify.mock.lastCall?.[1] as {
      recipientId: string;
      type: string;
      data: { previewBody: string };
    }[];
    expect(inputs.map((input) => input.recipientId)).toEqual([
      OWNER,
      OTHER_REPLIER,
    ]);
    expect(inputs.every((input) => input.type === 'share.reply')).toBe(true);
    expect(inputs[0].data.previewBody).toBe('Ngon quá');
  });

  it('drops a prior replier who can no longer see the share', async () => {
    const OWNER = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';
    const UNFRIENDED = 'e4ccff33-d04f-4cc2-af01-affdf0724e55';
    lockShare();
    insertReturning([
      {
        id: REPLY_ID,
        userId: mockUser.id,
        body: 'Ngon quá',
        createdAt: CREATED_AT,
      },
    ]);
    repliers([OWNER, UNFRIENDED, mockUser.id]);
    selectRows([]);
    // The author still sees the share; the prior replier lost access (e.g.
    // the owner unfriended them after their reply).
    mockCanViewShare.mockImplementation(async (viewerId: string) => {
      return viewerId !== UNFRIENDED;
    });

    await createShareReplyAction({
      shareId: SHARE_ID,
      replyId: REPLY_ID,
      body: 'Ngon quá',
    });

    const inputs = mockNotify.mock.lastCall?.[1] as { recipientId: string }[];
    expect(inputs.map((input) => input.recipientId)).toEqual([OWNER]);
    // The owner never goes through the gate — their own share is always theirs.
    expect(mockCanViewShare).not.toHaveBeenCalledWith(
      OWNER,
      expect.anything(),
      expect.anything()
    );
  });

  it('schedules one push for the whole thread audience after commit', async () => {
    const OWNER = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';
    const OTHER_REPLIER = 'e4ccff33-d04f-4cc2-af01-affdf0724e55';
    lockShare();
    insertReturning([
      {
        id: REPLY_ID,
        userId: mockUser.id,
        body: 'Ngon quá',
        createdAt: CREATED_AT,
      },
    ]);
    repliers([OWNER, OTHER_REPLIER]);
    selectRows([]);
    mockNotify.mockResolvedValueOnce([OWNER, OTHER_REPLIER]);

    await createShareReplyAction({
      shareId: SHARE_ID,
      replyId: REPLY_ID,
      body: 'Ngon quá',
    });

    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockSendNotificationPush).toHaveBeenCalledWith(
      [OWNER, OTHER_REPLIER],
      expect.objectContaining({
        type: 'share.reply',
        actor: { id: mockUser.id },
        groupKey: `share.reply:${SHARE_ID}`,
      })
    );
  });

  it('truncates the reply preview to 140 characters', async () => {
    const body = 'a'.repeat(200);
    lockShare();
    insertReturning([
      { id: REPLY_ID, userId: mockUser.id, body, createdAt: CREATED_AT },
    ]);
    selectRows([]);

    await createShareReplyAction({
      shareId: SHARE_ID,
      replyId: REPLY_ID,
      body,
    });

    const inputs = mockNotify.mock.lastCall?.[1] as {
      data: { previewBody: string };
    }[];
    expect(inputs[0].data.previewBody).toHaveLength(140);
  });

  it('returns not found before visibility checks when the share is missing', async () => {
    lockShare([]);

    await expect(
      createShareReplyAction({
        shareId: SHARE_ID,
        replyId: REPLY_ID,
        body: 'Ngon quá',
      })
    ).rejects.toThrow('Không tìm thấy bài chia sẻ.');
    expect(mockCanViewShare).not.toHaveBeenCalled();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('returns the existing actor-owned reply after an idempotency conflict', async () => {
    lockShare();
    insertReturning([]);
    selectRows([
      {
        id: REPLY_ID,
        userId: mockUser.id,
        body: 'Nội dung trước đó',
        createdAt: CREATED_AT,
      },
    ]);
    selectRows([]);

    const reply = await createShareReplyAction({
      shareId: SHARE_ID,
      replyId: REPLY_ID,
      body: 'Nội dung gửi lại',
    });

    expect(reply).toMatchObject({
      id: REPLY_ID,
      body: 'Nội dung trước đó',
      createdAt: CREATED_AT.toISOString(),
    });
  });

  // A retry writes nothing — the first attempt already inserted the row AND
  // notified for it. Notifying again would refresh the aggregate a second time
  // and republish a preview, one that could even carry the retry's body rather
  // than the text actually stored.
  it('does not re-notify when the retry only loaded the existing reply', async () => {
    lockShare();
    insertReturning([]);
    selectRows([
      {
        id: REPLY_ID,
        userId: mockUser.id,
        body: 'Nội dung trước đó',
        createdAt: CREATED_AT,
      },
    ]);
    selectRows([]);

    await createShareReplyAction({
      shareId: SHARE_ID,
      replyId: REPLY_ID,
      body: 'Nội dung gửi lại',
    });

    expect(mockNotify).not.toHaveBeenCalled();
    expect(mockTxSelectDistinct).not.toHaveBeenCalled();
    // Nothing was notified, so the wrapper queued nothing: after() still fires
    // but there is no push to send.
    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockSendNotificationPush).not.toHaveBeenCalled();
  });

  // The preview must quote what is stored, never the request body.
  it('previews the persisted reply body', async () => {
    lockShare();
    insertReturning([
      {
        id: REPLY_ID,
        userId: mockUser.id,
        body: 'Đã lưu',
        createdAt: CREATED_AT,
      },
    ]);
    selectRows([]);

    await createShareReplyAction({
      shareId: SHARE_ID,
      replyId: REPLY_ID,
      body: 'Đã lưu',
    });

    const inputs = mockNotify.mock.lastCall?.[1] as {
      data: { previewBody: string };
    }[];
    expect(inputs[0].data.previewBody).toBe('Đã lưu');
  });

  it('rejects a reply id already owned by another user', async () => {
    lockShare();
    insertReturning([]);
    selectRows([
      {
        id: REPLY_ID,
        userId: 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44',
        body: 'Khác',
        createdAt: CREATED_AT,
      },
    ]);

    await expect(
      createShareReplyAction({
        shareId: SHARE_ID,
        replyId: REPLY_ID,
        body: 'Ngon quá',
      })
    ).rejects.toThrow('Mã trả lời đã được sử dụng.');
  });
});
