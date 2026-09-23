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

// Same split as notify: the helper's own predicates live in
// lib/domain/notifications/__tests__/close-aggregates.test.ts; this suite only
// asserts WHOSE aggregates the split closes.

// ---------------------------------------------------------------------------
// Mocks — db.* is the singleton; tx.* is the transaction handle. Both are
// distinct mocks (mirrors meals.test.ts) so lookups never collide.
// ---------------------------------------------------------------------------

const { mockTxSelect, mockTxUpdate, mockTxInsert, mockTx } = vi.hoisted(() => {
  const mockTxSelect = vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(
        // Thenable + .for('update') — the share helper locks the row. The owner
        // has opted in to auto-share (the column default is off).
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
  capturedPredicates,
  cheatSourceMeal,
  friendEdge,
  type InsertCaptures,
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

  it('re-pends only offers the friend no longer holds', async () => {
    // `accepted` alone is not "held". A staged cheat card is accepted with no
    // meal for its whole ~7-day life — re-pending THAT put a second card in the
    // inbox and let both be confirmed — so the card's `pending_analyses` row
    // must keep it held. But an accepted copy whose meal the friend DELETED is
    // also accepted + no meal (`accepted_meal_id` is ON DELETE SET NULL), with
    // no card behind it; skipping that one meant a re-share could never reach
    // them again. The clause has to tell those two apart.
    queueLimitSelect([cheatSourceMeal()]);
    queueWhereSelect([friendEdge]);
    const captured: InsertCaptures = {};
    mockTxInsert.mockImplementation(routeInserts(captured));

    await shareMealWithFriendsAction({
      mealId: UUID_MEAL,
      friendUserIds: [UUID_FRIEND],
      mode: 'copy',
    });

    // Serialized: the doubles cannot run Postgres, so the clause itself is
    // what gets asserted (its behaviour was checked against a real database
    // when it was written — see `inviteStillHeld`).
    const { setWhere } = captured.invites.conflict as { setWhere: unknown };
    const clause = JSON.stringify(setWhere);
    expect(clause).toContain('NOT ');
    expect(clause).toContain("= 'accepted'");
    expect(clause).toContain('mealShareInvites.acceptedMealId');
    expect(clause).toContain('IS NOT NULL OR EXISTS');
    expect(clause).toContain('pendingAnalyses.sourceInviteId');
  });

  it('reports nobody offered when every invite was skipped', async () => {
    // The upsert's `setWhere` refuses to re-pend an invite that is already
    // ACCEPTED, so a re-share to that friend writes nothing and RETURNING comes
    // back empty. Counting the named recipients instead of the written rows
    // told the sender "sent to 1 friend" for a share that reached nobody —
    // indistinguishable from success, so they never try another way.
    queueLimitSelect([cheatSourceMeal()]);
    queueWhereSelect([friendEdge]);
    const captured: Record<string, { vals: unknown }> = {};
    mockTxInsert.mockImplementation(
      routeInserts(captured, {
        invitesWritten: () => [],
      })
    );

    const result = await shareMealWithFriendsAction({
      mealId: UUID_MEAL,
      friendUserIds: [UUID_FRIEND],
      mode: 'copy',
    });

    expect(result.invitedCount).toBe(0);
  });

  it('shares a cheat meal as a copy, without reading item rows', async () => {
    queueLimitSelect([cheatSourceMeal()]);
    // Exactly ONE queued where-select, for the friendship check. The precise
    // path consumes two here (items, then friendships), so if this ever starts
    // reading item rows for a cheat meal it will eat the friendship's slot and
    // fail — which is the assertion in the test's name.
    queueWhereSelect([friendEdge]);
    const captured: Record<string, { vals: unknown }> = {};
    mockTxInsert.mockImplementation(routeInserts(captured));

    const result = await shareMealWithFriendsAction({
      mealId: UUID_MEAL,
      friendUserIds: [UUID_FRIEND],
      mode: 'copy',
    });

    expect(result.invitedCount).toBe(1);
    // A copy leaves the sender's own meal alone — nothing to rescale.
    expect(result.meal).toBeNull();
    const invites = captured.invites.vals as Array<Record<string, unknown>>;
    expect(invites[0]).toMatchObject({
      mode: 'copy',
      toUserId: UUID_FRIEND,
      copyFactor: 1,
    });
    expect(mockNotify).toHaveBeenCalledTimes(1);
  });

  it('refuses to SPLIT a cheat meal', async () => {
    // Slider positions are not a dish you can divide: scaling them by a
    // fraction would invent a portion nobody chose. Copy, and let the
    // recipient set their own amounts.
    queueLimitSelect([cheatSourceMeal()]);
    await expect(
      shareMealWithFriendsAction({
        mealId: UUID_MEAL,
        friendUserIds: [UUID_FRIEND],
        mode: 'split',
      })
    ).rejects.toThrow('chia phần bữa xả');
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('refuses a cheat meal whose slider data is gone', async () => {
    queueLimitSelect([cheatSourceMeal({ cheatSliders: null })]);
    await expect(
      shareMealWithFriendsAction({
        mealId: UUID_MEAL,
        friendUserIds: [UUID_FRIEND],
        mode: 'copy',
      })
    ).rejects.toThrow('thanh trượt');
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
      actor: { id: mockUser.id },
      objectType: 'invite',
      objectId: 'invite-0',
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

  it('even split writes copy_factor 1, so accept stays a verbatim copy', async () => {
    queueLimitSelect([sourceMeal()]);
    queueWhereSelect([sourceItem()]);
    queueLimitSelect([]);
    queueWhereSelect([friendEdge]);
    queueLimitSelect([]);
    installUpdate({});
    const captured: Record<string, { vals: unknown }> = {};
    mockTxInsert.mockImplementation(routeInserts(captured));

    await shareMealWithFriendsAction({
      mealId: UUID_MEAL,
      friendUserIds: [UUID_FRIEND],
      mode: 'split',
    });

    const invites = captured.invites.vals as Array<Record<string, unknown>>;
    // This is the compatibility guarantee: pre-existing rows default to 1 and
    // every even split keeps producing 1, so accept behaves exactly as shipped.
    expect(invites[0]?.copyFactor).toBe(1);
  });

  it('uneven split: 13 parts to me, 7 to them', async () => {
    queueLimitSelect([sourceMeal()]);
    queueWhereSelect([sourceItem()]);
    queueLimitSelect([]);
    queueWhereSelect([friendEdge]);
    queueLimitSelect([]);

    const setValues: Record<string, unknown>[] = [];
    installUpdate({ captures: setValues });
    const captured: Record<string, { vals: unknown }> = {};
    mockTxInsert.mockImplementation(routeInserts(captured));

    const result = await shareMealWithFriendsAction({
      mealId: UUID_MEAL,
      friendUserIds: [UUID_FRIEND],
      mode: 'split',
      myParts: 13,
      splits: [{ userId: UUID_FRIEND, parts: 7 }],
    });

    // I keep 13/20 of the dish.
    expect(result.portionFactor).toBeCloseTo(0.65, 6);
    const mealUpdate = setValues[1];
    expect(mealUpdate?.portionFactor).toBeCloseTo(0.65, 6);

    const invites = captured.invites.vals as Array<Record<string, unknown>>;
    // Their share of the ORIGINAL dish — the inbox label.
    expect(Number(invites[0]?.portionFactor)).toBeCloseTo(0.35, 6);
    // …and what accept multiplies my already-scaled meal by: 7/13, NOT 0.35.
    // Conflating the two is the bug an uneven split would otherwise ship.
    expect(invites[0]?.copyFactor).toBeCloseTo(7 / 13, 6);
  });

  it('uneven split: three people, unequal runs', async () => {
    queueLimitSelect([sourceMeal()]);
    queueWhereSelect([sourceItem()]);
    queueLimitSelect([]);
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
      myParts: 10,
      splits: [
        { userId: UUID_FRIEND, parts: 6 },
        { userId: UUID_FRIEND_2, parts: 4 },
      ],
    });

    expect(result.portionFactor).toBeCloseTo(0.5, 6);
    const invites = captured.invites.vals as Array<Record<string, unknown>>;
    const byUser = new Map(invites.map((i) => [i.toUserId as string, i]));
    expect(Number(byUser.get(UUID_FRIEND)?.portionFactor)).toBeCloseTo(0.3, 6);
    expect(byUser.get(UUID_FRIEND)?.copyFactor).toBeCloseTo(0.6, 6);
    expect(Number(byUser.get(UUID_FRIEND_2)?.portionFactor)).toBeCloseTo(
      0.2,
      6
    );
    expect(byUser.get(UUID_FRIEND_2)?.copyFactor).toBeCloseTo(0.4, 6);
  });

  it('rejects parts naming myself — they would be silently discarded', async () => {
    // recipientIds drops self, but a self entry left in `splits` still passes
    // the 20-part sum. The parts allocated to it then belong to nobody: the
    // meal is scaled by myParts/20 while the dish no longer adds up.
    queueLimitSelect([sourceMeal()]);
    queueWhereSelect([sourceItem()]);
    queueLimitSelect([]);
    queueWhereSelect([friendEdge]);

    await expect(
      shareMealWithFriendsAction({
        mealId: UUID_MEAL,
        friendUserIds: [UUID_FRIEND, mockUser.id],
        mode: 'split',
        myParts: 2,
        splits: [
          { userId: UUID_FRIEND, parts: 2 },
          { userId: mockUser.id, parts: 16 },
        ],
      })
    ).rejects.toThrow('khớp với những người được chọn');
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('rejects parts that do not sum to the whole dish', async () => {
    queueLimitSelect([sourceMeal()]);
    queueWhereSelect([sourceItem()]);
    queueLimitSelect([]);
    queueWhereSelect([friendEdge]);

    await expect(
      shareMealWithFriendsAction({
        mealId: UUID_MEAL,
        friendUserIds: [UUID_FRIEND],
        mode: 'split',
        myParts: 12,
        splits: [{ userId: UUID_FRIEND, parts: 7 }], // 19, not 20
      })
    ).rejects.toThrow('bằng cả bữa ăn');
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('rejects a run under the floor', async () => {
    await expect(
      shareMealWithFriendsAction({
        mealId: UUID_MEAL,
        friendUserIds: [UUID_FRIEND],
        mode: 'split',
        myParts: 19,
        splits: [{ userId: UUID_FRIEND, parts: 1 }],
      })
      // Caught by zod's per-field min(2) before the transaction even opens.
    ).rejects.toThrow();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('rejects parts on a copy — only a split divides anything', async () => {
    await expect(
      shareMealWithFriendsAction({
        mealId: UUID_MEAL,
        friendUserIds: [UUID_FRIEND],
        mode: 'copy',
        myParts: 13,
        splits: [{ userId: UUID_FRIEND, parts: 7 }],
      })
    ).rejects.toThrow();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('rejects parts for someone who was not selected', async () => {
    await expect(
      shareMealWithFriendsAction({
        mealId: UUID_MEAL,
        friendUserIds: [UUID_FRIEND],
        mode: 'split',
        myParts: 13,
        splits: [{ userId: UUID_FRIEND_2, parts: 7 }],
      })
    ).rejects.toThrow();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('rejects a split when a selected friend already accepted this meal', async () => {
    // Copy-then-split path: the friend accepted a copy earlier; a split would
    // scale the sender's meal while the protected upsert creates no new offer.
    capturedPredicates.length = 0;
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
    // "Accepted" here means still HELD — the same predicate as the upsert, so
    // a friend who deleted their copy is not wrongly counted as having it.
    expect(
      capturedPredicates.some((p) =>
        p.includes('pendingAnalyses.sourceInviteId')
      )
    ).toBe(true);
    // The sender's meal must NOT be scaled and no invite rows written.
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  // The third party never acts on the offer — it vanishes under them — so
  // nothing on their side could ever read the row. The split closes it for
  // them, in the same tx that dismissed the invite; a later re-offer of this
  // meal then opens fresh history instead of rewriting the stale card.
  it('split mode: closes the notification of every auto-dismissed third party', async () => {
    queueLimitSelect([sourceMeal()]);
    queueWhereSelect([sourceItem()]);
    queueLimitSelect([]); // no already-accepted invite among the recipients
    queueWhereSelect([friendEdge]);
    queueLimitSelect([]); // no existing share row (scaleOwnMealInPlace)
    // The only `.returning()` in this transaction is the auto-dismiss sweep.
    installUpdate({ returning: [{ toUserId: UUID_FRIEND_2 }] });
    mockTxInsert.mockImplementation(routeInserts({}));

    await shareMealWithFriendsAction({
      mealId: UUID_MEAL,
      friendUserIds: [UUID_FRIEND],
      mode: 'split',
    });

    // ONE statement for the whole set of auto-dismissed third parties, not a
    // close per person.
    expect(mockCloseAggregates).toHaveBeenCalledTimes(1);
    expect(mockCloseAggregates).toHaveBeenCalledWith(mockTx, {
      recipientIds: [UUID_FRIEND_2],
      groupKey: `share.invite:${UUID_MEAL}`,
    });
  });

  it('copy mode: dismisses nothing, so no notification is closed', async () => {
    queueLimitSelect([sourceMeal()]);
    queueWhereSelect([sourceItem()]);
    queueWhereSelect([friendEdge]);
    mockTxInsert.mockImplementation(routeInserts({}));

    await shareMealWithFriendsAction({
      mealId: UUID_MEAL,
      friendUserIds: [UUID_FRIEND],
      mode: 'copy',
    });

    expect(mockCloseAggregates).not.toHaveBeenCalled();
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
