import { beforeEach, describe, expect, it, vi } from 'vitest';

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
