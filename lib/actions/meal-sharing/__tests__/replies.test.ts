import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUser, mockCanViewShare, mockTxInsert, mockTxSelect, mockTx } =
  vi.hoisted(() => {
    const mockTxInsert = vi.fn();
    const mockTxSelect = vi.fn();
    return {
      mockUser: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
      mockCanViewShare: vi.fn(),
      mockTxInsert,
      mockTxSelect,
      mockTx: {
        insert: mockTxInsert,
        select: mockTxSelect,
      },
    };
  });

vi.mock('@/lib/auth/session', () => ({
  requireAuthAndProfile: vi.fn().mockResolvedValue({
    user: mockUser,
    profile: {},
  }),
}));
vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn((run: (tx: typeof mockTx) => Promise<unknown>) =>
      run(mockTx)
    ),
  },
}));
vi.mock('@/lib/social/shares/share-visibility', () => ({
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

describe('createShareReplyAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanViewShare.mockResolvedValue(true);
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
