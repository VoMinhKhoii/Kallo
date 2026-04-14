import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUser,
  mockProfile,
  mockDbSelect,
  mockDbDelete,
  mockDbInsert,
  mockDbUpdate,
  mockTxInsert,
  mockTxUpdate,
  mockTx,
} = vi.hoisted(() => {
  const mockDbSelect = vi.fn();
  const mockDbDelete = vi.fn();
  const mockDbInsert = vi.fn();
  const mockDbUpdate = vi.fn();
  const mockTxInsert = vi.fn();
  const mockTxUpdate = vi.fn();
  const mockTx = {
    insert: mockTxInsert,
    update: mockTxUpdate,
  };

  return {
    mockUser: { id: 'user-123', email: 'test@example.com' },
    mockProfile: {
      userId: 'user-123',
      weightKg: '70.0',
      goal: 'cutting',
      regionalProfile: 'mien_bac',
    },
    mockDbSelect,
    mockDbDelete,
    mockDbInsert,
    mockDbUpdate,
    mockTxInsert,
    mockTxUpdate,
    mockTx,
  };
});

vi.mock('@/lib/auth', () => ({
  requireAuthAndProfile: vi.fn().mockResolvedValue({
    user: mockUser,
    profile: mockProfile,
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx)
    ),
    select: mockDbSelect,
    delete: mockDbDelete,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}));

vi.mock('@/lib/db/schema', () => ({
  bodyWeightLog: {
    userId: 'bodyWeightLog.userId',
    loggedDate: 'bodyWeightLog.loggedDate',
    weightKg: 'bodyWeightLog.weightKg',
    createdAt: 'bodyWeightLog.createdAt',
  },
  userProfiles: {
    userId: 'userProfiles.userId',
    weightKg: 'userProfiles.weightKg',
    updatedAt: 'userProfiles.updatedAt',
    goal: 'userProfiles.goal',
  },
}));

import {
  deleteWeightLogAction,
  loadWeightSummaryAction,
  logWeightAction,
} from '@/lib/actions/weight';

describe('logWeightAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts a weight log and refreshes the profile weight snapshot', async () => {
    mockTxInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              loggedDate: '2026-04-14',
              weightKg: '71.2',
            },
          ]),
        }),
      }),
    });

    mockTxUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const result = await logWeightAction({
      loggedDate: '2026-04-14',
      weightKg: 71.2,
    });

    expect(result).toEqual({
      success: true,
      loggedDate: '2026-04-14',
      weightKg: 71.2,
    });
    expect(mockDbInsert).not.toHaveBeenCalled();
    expect(mockTxInsert).toHaveBeenCalledTimes(1);
    expect(mockTxUpdate).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid weight input', async () => {
    await expect(
      logWeightAction({ loggedDate: 'bad-date', weightKg: 10 })
    ).rejects.toThrow();
  });
});

describe('deleteWeightLogAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes an existing weight log', async () => {
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          { loggedDate: '2026-04-14' },
        ]),
      }),
    });

    const result = await deleteWeightLogAction({ loggedDate: '2026-04-14' });

    expect(result).toEqual({
      success: true,
      loggedDate: '2026-04-14',
    });
  });

  it('throws when no log exists for the date', async () => {
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    });

    await expect(
      deleteWeightLogAction({ loggedDate: '2026-04-14' })
    ).rejects.toThrow('Không tìm thấy cân nặng');
  });
});

describe('loadWeightSummaryAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-14T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads range rows and computes summary metadata', async () => {
    const rangeRows = [
      { loggedDate: '2026-04-12', weightKg: '72.4' },
      { loggedDate: '2026-04-14', weightKg: '71.8' },
    ];
    const latestRows = [{ loggedDate: '2026-04-14', weightKg: '71.8' }];

    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(rangeRows),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(latestRows),
            }),
          }),
        }),
      });

    const result = await loadWeightSummaryAction({
      range: '30d',
      timezoneOffset: 0,
    });

    expect(result.range).toBe('30d');
    expect(result.weights).toEqual([72.4, 71.8]);
    expect(result.currentWeight).toBe(71.8);
    expect(result.todayWeight).toBe(71.8);
    expect(result.daysLogged).toBe(2);
    expect(result.goalDirection).toBe('down');
    expect(result.periodStartWeight).toBe(72.4);
    expect(result.expectedEndWeight).toBeLessThan(result.periodStartWeight);
  });
});
