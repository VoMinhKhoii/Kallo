import { beforeEach, describe, expect, it, vi } from 'vitest';

// `after()` needs a request scope these unit suites do not have; run it inline.
const { mockAfter } = vi.hoisted(() => ({
  mockAfter: vi.fn((task: () => unknown) => {
    void task();
  }),
}));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  after: mockAfter,
}));
vi.mock('@/lib/domain/notifications/push', () => ({
  sendNotificationPush: vi.fn(async (): Promise<void> => undefined),
  sendChatMessagePush: vi.fn(async (): Promise<void> => undefined),
}));

const { mockNotify, mockRetractActor, mockCloseAggregates } = vi.hoisted(
  () => ({
    mockNotify: vi.fn(async (..._args: unknown[]): Promise<string[]> => []),
    mockRetractActor: vi.fn(
      async (..._args: unknown[]): Promise<void> => undefined
    ),
    mockCloseAggregates: vi.fn(
      async (..._args: unknown[]): Promise<void> => undefined
    ),
  })
);
vi.mock('@/lib/domain/notifications/notify', () => ({
  notify: mockNotify,
  retractActor: mockRetractActor,
  closeAggregates: mockCloseAggregates,
}));

// tx.delete is new here — undo is the only sharing path that removes rows.
const { mockTxSelect, mockTxUpdate, mockTxInsert, mockTxDelete, mockTx } =
  vi.hoisted(() => {
    const mockTxSelect = vi.fn();
    const mockTxUpdate = vi.fn();
    const mockTxInsert = vi.fn();
    const mockTxDelete = vi.fn();
    return {
      mockTxSelect,
      mockTxUpdate,
      mockTxInsert,
      mockTxDelete,
      mockTx: {
        select: mockTxSelect,
        update: mockTxUpdate,
        insert: mockTxInsert,
        delete: mockTxDelete,
      },
    };
  });

vi.mock('@/lib/infra/auth/session', async () => ({
  requireAuthAndProfile: vi.fn().mockResolvedValue({
    user: (await import('./share-doubles')).MOCK_USER,
    profile: {},
  }),
}));

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx)
    ),
  },
}));

vi.mock(
  '@/lib/infra/db/schema',
  async () => (await import('./share-doubles')).schema
);

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import { undoMealShareAction } from '@/lib/actions/meal-sharing/undo';
import {
  sourceItem,
  sourceMeal,
  txQueues,
  UUID_FRIEND,
  UUID_MEAL,
} from './share-doubles';

const { queueLimitSelect, queueWhereSelect, installUpdate } = txQueues(
  mockTxSelect,
  mockTxUpdate
);

/** `tx.delete().where().returning()` — the only delete in the sharing paths. */
function installDelete(returning: unknown[]) {
  mockTxDelete.mockImplementation(() => ({
    where: () => ({ returning: () => Promise.resolve(returning) }),
  }));
}

describe('undoMealShareAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses once a friend has accepted — their copy is not ours to revoke', async () => {
    queueLimitSelect([sourceMeal({ portionFactor: 0.5, caloriesKcal: 100 })]);
    queueWhereSelect([{ toUserId: UUID_FRIEND, status: 'accepted' }]);

    await expect(undoMealShareAction({ mealId: UUID_MEAL })).rejects.toThrow(
      'đã nhận phần rồi'
    );
    // Nothing written back: the sender's meal keeps its split portion, and the
    // friend keeps the copy they already logged.
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxDelete).not.toHaveBeenCalled();
  });

  it('refuses a meal that was never split', async () => {
    queueLimitSelect([sourceMeal({ portionFactor: 1, caloriesKcal: 200 })]);

    await expect(undoMealShareAction({ mealId: UUID_MEAL })).rejects.toThrow(
      'chưa được chia phần'
    );
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('is scoped to the actor — you cannot undo a meal that is not yours', async () => {
    queueLimitSelect([]); // the actor-scoped, row-locked lookup finds nothing

    await expect(undoMealShareAction({ mealId: UUID_MEAL })).rejects.toThrow(
      'không thuộc về bạn'
    );
  });

  it('restores the full portion and withdraws the pending offers', async () => {
    // The sender kept 13/20, so their meal sits at 0.65 — 650 of 1000 kcal.
    queueLimitSelect([sourceMeal({ portionFactor: 0.65, caloriesKcal: 650 })]);
    queueWhereSelect([{ toUserId: UUID_FRIEND, status: 'pending' }]);
    queueWhereSelect([sourceItem({ estimatedGrams: 130, caloriesKcal: 650 })]);
    queueLimitSelect([]); // no share row (read inside scaleOwnMealInPlace)

    const setValues: Record<string, unknown>[] = [];
    installUpdate({ captures: setValues });
    installDelete([{ toUserId: UUID_FRIEND }]);

    const result = await undoMealShareAction({ mealId: UUID_MEAL });

    // Items first, then the meal — the same write order the split uses.
    expect(setValues[0]?.estimatedGrams).toBeCloseTo(200, 6);
    expect(setValues[0]?.caloriesKcal).toBeCloseTo(1000, 6);
    expect(setValues[1]?.caloriesKcal).toBeCloseTo(1000, 6);
    // Scaled BY 1/0.65 but LEFT AT 1. Reusing the split's own
    // "portionFactor = factor" rule would have written 1.538 here and left the
    // meal claiming to be half again larger than a full portion.
    expect(setValues[1]?.portionFactor).toBe(1);
    expect(result.meal.portionFactor).toBe(1);

    // Deleted, not dismissed: the recipient made no decision and should be
    // left no history of one.
    expect(mockTxDelete).toHaveBeenCalled();
    // And the notification closes in the same transaction, so their feed card
    // does not outlive the row it points at.
    expect(mockCloseAggregates).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ recipientIds: [UUID_FRIEND] })
    );
  });
});
