import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUser,
  mockGetUser,
  mockTxExecute,
  mockTxSelect,
  mockTxInsert,
  mockTx,
} = vi.hoisted(() => {
  const mockTxExecute = vi.fn();
  const mockTxSelect = vi.fn();
  const mockTxInsert = vi.fn();
  return {
    mockUser: { id: 'user-123', email: 'test@example.com' },
    mockGetUser: vi.fn(),
    mockTxExecute,
    mockTxSelect,
    mockTxInsert,
    mockTx: {
      execute: mockTxExecute,
      select: mockTxSelect,
      insert: mockTxInsert,
    },
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}));

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx)
    ),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  userFeedback: {
    id: 'userFeedback.id',
    userId: 'userFeedback.userId',
    createdAt: 'userFeedback.createdAt',
  },
}));

import { submitFeedbackAction } from '@/lib/actions/feedback';

function stubHourlyCount(count: number) {
  mockTxSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ count }]),
    }),
  });
}

function stubInsertReturning(id: string) {
  const values = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id }]),
  });
  mockTxInsert.mockReturnValue({ values });
  return values;
}

describe('submitFeedbackAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockTxExecute.mockResolvedValue(undefined);
  });

  it('inserts with the session user id (never client input) and returns the new id', async () => {
    stubHourlyCount(0);
    const values = stubInsertReturning('fb-1');

    const result = await submitFeedbackAction({
      type: 'bug',
      message: 'The camera crashes on scan.',
      platform: 'ios',
      locale: 'vi',
    });

    expect(result).toEqual({ id: 'fb-1' });
    // The count-then-insert runs behind a per-user advisory lock.
    expect(mockTxExecute).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        type: 'bug',
        message: 'The camera crashes on scan.',
        platform: 'ios',
        locale: 'vi',
      })
    );
  });

  it('rate-limits after 10 submissions in the last hour', async () => {
    stubHourlyCount(10);
    stubInsertReturning('should-not-be-used');

    await expect(
      submitFeedbackAction({ type: 'idea', message: 'another one' })
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('rejects a screenshotPath that is not owned by the session user', async () => {
    stubHourlyCount(0);
    stubInsertReturning('fb-2');

    await expect(
      submitFeedbackAction({
        type: 'bug',
        message: 'x',
        // valid format, but the owner segment is someone else's id
        screenshotPath:
          '00000000-0000-0000-0000-000000000000/11111111-1111-1111-1111-111111111111.png',
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', status: 400 });
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('rejects when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(
      submitFeedbackAction({ type: 'bug', message: 'x' })
    ).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED', status: 401 });
    expect(mockTxSelect).not.toHaveBeenCalled();
  });
});
