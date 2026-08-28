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

// ---------------------------------------------------------------------------
// Mocks — db.* is the singleton; tx.* is the transaction handle. Both are
// distinct mocks (mirrors meals.test.ts) so lookups never collide.
// ---------------------------------------------------------------------------

const { mockTxSelect, mockTxUpdate, mockTxInsert, mockTx } = vi.hoisted(() => {
  const mockTxSelect = vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(
        // Thenable + .for('update') — the share helper locks the row.
        Object.assign(Promise.resolve([{ autoShareToCircle: true }]), {
          for: vi.fn().mockResolvedValue([{ autoShareToCircle: true }]),
        })
      ),
    }),
  }));
  const mockTxUpdate = vi.fn();
  const mockTxInsert = vi.fn();
  return {
    mockTxSelect,
    mockTxUpdate,
    mockTxInsert,
    mockTx: {
      select: mockTxSelect,
      update: mockTxUpdate,
      insert: mockTxInsert,
    },
  };
});

// copy_split gate. Stubbed so the locked case is reachable without an
// entitlements fixture; the default no-op resolve mirrors an unenforced build.
const assertFeatureAccess = vi.hoisted(() => vi.fn());
vi.mock('@/lib/domain/billing/feature-gate', () => ({ assertFeatureAccess }));

vi.mock('@/lib/infra/auth/session', async () => ({
  requireAuthAndProfile: vi.fn().mockResolvedValue({
    user: (await import('./share-doubles')).MOCK_USER,
    profile: {
      createdAt: (await import('./share-doubles')).PROFILE_CREATED_AT,
    },
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

import { shareMealWithFriendsAction } from '@/lib/actions/meal-sharing/share-with-friends';
import { FeatureLockedError } from '@/lib/core/errors/app-error';
import {
  friendEdge,
  MOCK_USER as mockUser,
  PROFILE_CREATED_AT,
  routeInserts,
  sourceItem,
  sourceMeal,
  txQueues,
  UUID_FRIEND,
  UUID_FRIEND_2,
  UUID_MEAL,
} from './share-doubles';

const { queueLimitSelect, queueWhereSelect, installUpdate } = txQueues(
  mockTxSelect,
  mockTxUpdate
);

describe('shareMealWithFriendsAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a meal that belongs to another user', async () => {
    queueLimitSelect([]); // scoped meal lookup finds nothing
    await expect(
      shareMealWithFriendsAction({
        mealId: UUID_MEAL,
        friendUserIds: [UUID_FRIEND],
        mode: 'copy',
      })
    ).rejects.toThrow('không thuộc về bạn');
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('refuses to share a cheat meal', async () => {
    queueLimitSelect([sourceMeal({ entryMode: 'cheat' })]);
    await expect(
      shareMealWithFriendsAction({
        mealId: UUID_MEAL,
        friendUserIds: [UUID_FRIEND],
        mode: 'copy',
      })
    ).rejects.toThrow('bữa xả');
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('refuses a meal with no item rows', async () => {
    queueLimitSelect([sourceMeal()]);
    queueWhereSelect([]); // no items
    await expect(
      shareMealWithFriendsAction({
        mealId: UUID_MEAL,
        friendUserIds: [UUID_FRIEND],
        mode: 'copy',
      })
    ).rejects.toThrow('không có món');
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('refuses to split an already-fractional meal (no compounding)', async () => {
    queueLimitSelect([sourceMeal({ portionFactor: 0.5 })]);
    queueWhereSelect([sourceItem()]);
    await expect(
      shareMealWithFriendsAction({
        mealId: UUID_MEAL,
        friendUserIds: [UUID_FRIEND],
        mode: 'split',
      })
    ).rejects.toThrow('đã được chia phần');
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('rejects a recipient who is not an accepted friend', async () => {
    queueLimitSelect([sourceMeal()]);
    queueWhereSelect([sourceItem()]);
    queueWhereSelect([]); // no accepted-friend edge for the recipient
    await expect(
      shareMealWithFriendsAction({
        mealId: UUID_MEAL,
        friendUserIds: [UUID_FRIEND],
        mode: 'copy',
      })
    ).rejects.toThrow('bạn bè đã kết nối');
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('copy mode: factor 1, leaves the meal untouched, inserts pending invites', async () => {
    queueLimitSelect([sourceMeal()]);
    queueWhereSelect([sourceItem()]);
    queueWhereSelect([friendEdge]);
    const captured: Record<string, { vals: unknown }> = {};
    mockTxInsert.mockImplementation(routeInserts(captured));

    const result = await shareMealWithFriendsAction({
      mealId: UUID_MEAL,
      friendUserIds: [UUID_FRIEND],
      mode: 'copy',
    });

    expect(result.portionFactor).toBe(1);
    expect(result.invitedCount).toBe(1);
    expect(result.meal).toBeNull();
    // Copy never rescales the logger's own meal.
    expect(mockTxUpdate).not.toHaveBeenCalled();

    const invites = captured.invites.vals as Array<Record<string, unknown>>;
    expect(invites).toHaveLength(1);
    expect(invites[0]?.mode).toBe('copy');
    expect(invites[0]?.portionFactor).toBe('1');
    expect(invites[0]?.toUserId).toBe(UUID_FRIEND);
    expect(invites[0]?.fromUserId).toBe(mockUser.id);
  });

  it('notifies exactly the recipients whose invite row was written', async () => {
    queueLimitSelect([sourceMeal()]);
    queueWhereSelect([sourceItem()]);
    queueWhereSelect([friendEdge]);
    mockTxInsert.mockImplementation(routeInserts({}));

    await shareMealWithFriendsAction({
      mealId: UUID_MEAL,
      friendUserIds: [UUID_FRIEND],
      mode: 'copy',
    });

    expect(mockNotify.mock.lastCall?.[1]).toEqual([
      {
        recipientId: UUID_FRIEND,
        type: 'share.invite',
        actorId: mockUser.id,
        objectType: 'invite',
        objectId: 'invite-0',
        groupKey: `share.invite:${UUID_MEAL}`,
        data: { mode: 'copy', portionFactor: 1, mealName: 'Trà sữa' },
      },
    ]);
  });

  it('schedules the invite push after the offer commits', async () => {
    queueLimitSelect([sourceMeal()]);
    queueWhereSelect([sourceItem()]);
    queueWhereSelect([friendEdge]);
    mockTxInsert.mockImplementation(routeInserts({}));
    mockNotify.mockResolvedValueOnce([UUID_FRIEND]);

    await shareMealWithFriendsAction({
      mealId: UUID_MEAL,
      friendUserIds: [UUID_FRIEND],
      mode: 'copy',
    });

    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockSendNotificationPush).toHaveBeenCalledWith([UUID_FRIEND], {
      type: 'share.invite',
      actorId: mockUser.id,
      groupKey: `share.invite:${UUID_MEAL}`,
    });
  });

  it('split mode: halves the meal for two participants and stores factor 0.5', async () => {
    queueLimitSelect([sourceMeal()]);
    queueWhereSelect([sourceItem()]);
    queueLimitSelect([]); // no already-accepted invite among the recipients
    queueWhereSelect([friendEdge]);
    queueLimitSelect([]); // no existing share row (scaleOwnMealInPlace)

    const setValues: Record<string, unknown>[] = [];
    installUpdate({ captures: setValues });
    const captured: Record<string, { vals: unknown }> = {};
    mockTxInsert.mockImplementation(routeInserts(captured));

    const result = await shareMealWithFriendsAction({
      mealId: UUID_MEAL,
      friendUserIds: [UUID_FRIEND],
      mode: 'split',
    });

    expect(result.portionFactor).toBe(0.5);
    // Item update (grams+cals halved) then the meal update (portionFactor set).
    const itemUpdate = setValues[0];
    expect(itemUpdate?.estimatedGrams).toBe(200);
    expect(itemUpdate?.caloriesKcal).toBe(100);
    const mealUpdate = setValues[1];
    expect(mealUpdate?.caloriesKcal).toBe(100);
    expect(mealUpdate?.portionFactor).toBe(0.5);
    expect(result.meal?.nutrition.caloriesKcal).toBe(100);
    expect(result.meal?.portionFactor).toBe(0.5);

    const invites = captured.invites.vals as Array<Record<string, unknown>>;
    expect(invites[0]?.mode).toBe('split');
    expect(invites[0]?.portionFactor).toBe('0.5');
  });

  it('split mode: three participants → factor 1/3 for two friends', async () => {
    queueLimitSelect([sourceMeal()]);
    queueWhereSelect([sourceItem()]);
    queueLimitSelect([]); // no already-accepted invite among the recipients
    queueWhereSelect([
      friendEdge,
      { userLow: UUID_FRIEND_2, userHigh: mockUser.id },
    ]);
    queueLimitSelect([]);
    installUpdate({});
    const captured: Record<string, { vals: unknown }> = {};
    mockTxInsert.mockImplementation(routeInserts(captured));

    const result = await shareMealWithFriendsAction({
      mealId: UUID_MEAL,
      friendUserIds: [UUID_FRIEND, UUID_FRIEND_2],
      mode: 'split',
    });

    expect(result.portionFactor).toBeCloseTo(1 / 3);
    expect(result.invitedCount).toBe(2);
    const invites = captured.invites.vals as Array<Record<string, unknown>>;
    expect(invites).toHaveLength(2);
  });

  it('rejects a split when a selected friend already accepted this meal', async () => {
    // Copy-then-split path: the friend accepted a copy earlier; a split would
    // scale the sender's meal while the protected upsert creates no new offer.
    queueLimitSelect([sourceMeal()]);
    queueWhereSelect([sourceItem()]);
    queueLimitSelect([{ toUserId: UUID_FRIEND }]); // accepted invite exists
    await expect(
      shareMealWithFriendsAction({
        mealId: UUID_MEAL,
        friendUserIds: [UUID_FRIEND],
        mode: 'split',
      })
    ).rejects.toThrow('đã nhận phần');
    // The sender's meal must NOT be scaled and no invite rows written.
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('rejects an invalid mealId', async () => {
    await expect(
      shareMealWithFriendsAction({
        mealId: 'bad',
        friendUserIds: [UUID_FRIEND],
        mode: 'copy',
      })
    ).rejects.toThrow();
  });
});

describe('shareMealWithFriendsAction — premium (copy_split)', () => {
  // Sending is the gated half. Accept stays free on purpose: a split has
  // already halved the SENDER's meal by the time the invite lands, so refusing
  // a free recipient's accept would strand a paying user's portion.
  beforeEach(() => vi.clearAllMocks());

  it('refuses a locked sender before the transaction opens', async () => {
    assertFeatureAccess.mockRejectedValueOnce(
      new FeatureLockedError('copy_split', 'not_entitled', 'locked')
    );

    await expect(
      shareMealWithFriendsAction({
        mealId: UUID_MEAL,
        friendUserIds: [UUID_FRIEND],
        mode: 'split',
      })
    ).rejects.toBeInstanceOf(FeatureLockedError);

    expect(assertFeatureAccess).toHaveBeenCalledWith(
      { userId: mockUser.id, profileCreatedAt: PROFILE_CREATED_AT },
      'copy_split'
    );
    expect(mockTxSelect).not.toHaveBeenCalled();
    expect(mockTxInsert).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });
});
