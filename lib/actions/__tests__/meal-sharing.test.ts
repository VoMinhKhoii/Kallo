import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — db.* is the singleton; tx.* is the transaction handle. Both are
// distinct mocks (mirrors meals.test.ts) so lookups never collide.
// ---------------------------------------------------------------------------

const {
  mockUser,
  mockTxSelect,
  mockTxUpdate,
  mockTxInsert,
  mockDbSelect,
  mockDbUpdate,
  mockTx,
} = vi.hoisted(() => {
  const mockTxSelect = vi.fn();
  const mockTxUpdate = vi.fn();
  const mockTxInsert = vi.fn();
  return {
    mockUser: { id: 'user-123', email: 'me@example.com' },
    mockTxSelect,
    mockTxUpdate,
    mockTxInsert,
    mockDbSelect: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockTx: {
      select: mockTxSelect,
      update: mockTxUpdate,
      insert: mockTxInsert,
    },
  };
});

vi.mock('@/lib/auth', () => ({
  requireAuthAndProfile: vi
    .fn()
    .mockResolvedValue({ user: mockUser, profile: {} }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx)
    ),
    select: mockDbSelect,
    update: mockDbUpdate,
  },
}));

vi.mock('@/lib/db/schema', () => ({
  meals: { id: 'meals.id', userId: 'meals.userId' },
  mealItems: { id: 'mealItems.id', mealId: 'mealItems.mealId' },
  mealShares: {
    id: 'mealShares.id',
    mealId: 'mealShares.mealId',
    visibility: 'mealShares.visibility',
  },
  mealShareInvites: {
    id: 'mealShareInvites.id',
    sourceMealId: 'mealShareInvites.sourceMealId',
    toUserId: 'mealShareInvites.toUserId',
    fromUserId: 'mealShareInvites.fromUserId',
    status: 'mealShareInvites.status',
  },
  friendships: {
    id: 'friendships.id',
    userLow: 'friendships.userLow',
    userHigh: 'friendships.userHigh',
    status: 'friendships.status',
  },
  publicProfiles: { userId: 'publicProfiles.userId' },
}));

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import {
  acceptMealShareInviteAction,
  dismissMealShareInviteAction,
  shareMealWithFriendsAction,
} from '@/lib/actions/meal-sharing';

const UUID_MEAL = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const UUID_FRIEND = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const UUID_FRIEND_2 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const UUID_ITEM = 'd3bbef22-cf3e-4bb1-9e90-9eecef613d44';
const UUID_INVITE = 'e4ccff33-d04f-4cc2-af01-affdf0724e55';
const UUID_NEW = 'f5dd0044-e150-4dd3-b012-b00e01835f66';
const LOGGED_AT = new Date('2026-04-05T17:30:00.000Z');

// select ending in .limit(1) — meal / friendship / source / share lookups.
function queueLimitSelect(rows: unknown[]) {
  mockTxSelect.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

// select awaited at .where() — friendship / item lookups.
function queueWhereSelect(rows: unknown[]) {
  mockTxSelect.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  });
}

// One tx.update implementation handling both shapes: `.set().where()` (awaited)
// and `.set().where().returning()` (the atomic claim). Captured set-values land
// in `captures`; `.returning()` yields `returning`.
function installUpdate(opts: {
  returning?: unknown[];
  captures?: Record<string, unknown>[];
}) {
  mockTxUpdate.mockImplementation(() => ({
    set: (vals: Record<string, unknown>) => {
      opts.captures?.push(vals);
      const where = Object.assign(Promise.resolve(undefined), {
        returning: () => Promise.resolve(opts.returning ?? []),
      });
      return { where: () => where };
    },
  }));
}

function sourceMeal(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID_MEAL,
    userId: mockUser.id,
    rawInput: 'Trà sữa',
    mealSlot: 'snack',
    confidenceOverall: 'high',
    loggedAt: LOGGED_AT,
    entryMode: 'precise',
    alcoholG: null,
    portionFactor: 1,
    caloriesKcal: 200,
    proteinG: 4,
    carbohydrateG: 40,
    fatG: 5,
    ...overrides,
  };
}

function sourceItem(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID_ITEM,
    mealId: UUID_MEAL,
    ingredientName: 'Trà sữa',
    mealItemName: 'Trà sữa',
    mealItemOrder: 0,
    foodCompositionId: 'fc-1',
    estimatedGrams: 400,
    userFacingUnit: '1 ly',
    cookingMethod: null,
    matchConfidence: 0.9,
    caloriesKcal: 200,
    proteinG: 4,
    carbohydrateG: 40,
    fatG: 5,
    ...overrides,
  };
}

const friendEdge = { userLow: mockUser.id, userHigh: UUID_FRIEND };

// Route tx.insert by table: meals → returning [{id}], mealShares → the default
// circle-share chain, meal_share_invites / mealItems → capture the values.
function routeInserts(captured: Record<string, { vals: unknown }>) {
  return (table: { id?: string; sourceMealId?: string }) => {
    if (table?.id === 'mealShares.id') {
      return {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValue([{ id: 'share-1', visibility: 'circle' }]),
          }),
        }),
      };
    }
    if (table?.sourceMealId === 'mealShareInvites.sourceMealId') {
      return {
        values: vi.fn().mockImplementation((vals: unknown) => {
          captured.invites = { vals };
          return { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) };
        }),
      };
    }
    // meals or mealItems
    return {
      values: vi.fn().mockImplementation((vals: unknown) => {
        if (table?.id === 'meals.id') {
          captured.meal = { vals };
          return { returning: vi.fn().mockResolvedValue([{ id: UUID_NEW }]) };
        }
        captured.items = { vals };
        return undefined;
      }),
    };
  };
}

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

  it('split mode: halves the meal for two participants and stores factor 0.5', async () => {
    queueLimitSelect([sourceMeal()]);
    queueWhereSelect([sourceItem()]);
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

describe('acceptMealShareInviteAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects when the invite cannot be claimed (tenant safety / race)', async () => {
    installUpdate({ returning: [] }); // claim UPDATE matches zero rows
    await expect(
      acceptMealShareInviteAction({
        inviteId: UUID_INVITE,
        loggedDate: '2026-04-05',
        timezoneOffset: -420,
      })
    ).rejects.toThrow('Lời mời');
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('rejects when no longer an accepted friend of the sender', async () => {
    installUpdate({
      returning: [{ sourceMealId: UUID_MEAL, fromUserId: UUID_FRIEND }],
    });
    queueLimitSelect([]); // friendship recheck finds nothing
    await expect(
      acceptMealShareInviteAction({
        inviteId: UUID_INVITE,
        loggedDate: '2026-04-05',
        timezoneOffset: -420,
      })
    ).rejects.toThrow('không còn là bạn bè');
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('copies the source meal verbatim into my diary with its portion', async () => {
    installUpdate({
      returning: [{ sourceMealId: UUID_MEAL, fromUserId: UUID_FRIEND }],
    });
    queueLimitSelect([{ id: 'friendship-1' }]); // still friends
    queueLimitSelect([sourceMeal({ portionFactor: 0.5, caloriesKcal: 100 })]); // the sender's split share
    queueWhereSelect([sourceItem({ estimatedGrams: 200, caloriesKcal: 100 })]);

    const captured: Record<string, { vals: unknown }> = {};
    mockTxInsert.mockImplementation(routeInserts(captured));

    const result = await acceptMealShareInviteAction({
      inviteId: UUID_INVITE,
      newMealId: UUID_NEW,
      loggedDate: '2026-04-05',
      timezoneOffset: -420,
    });

    // A brand-new meal owned by me, carrying the source's (already-portioned)
    // numbers verbatim and inheriting its portion factor.
    const mealVals = captured.meal.vals as Record<string, unknown>;
    expect(mealVals.userId).toBe(mockUser.id);
    expect(mealVals.caloriesKcal).toBe(100);
    expect(mealVals.portionFactor).toBe(0.5);
    const items = captured.items.vals as Array<Record<string, unknown>>;
    expect(items[0]?.estimatedGrams).toBe(200);
    expect(items[0]?.mealId).toBe(UUID_NEW);
    expect(items[0]?.id).not.toBe(UUID_ITEM); // fresh id

    expect(result.mealId).toBe(UUID_NEW);
    expect(result.meal.portionFactor).toBe(0.5);
    expect(result.meal.share).toEqual({
      shareId: 'share-1',
      visibility: 'circle',
    });
  });

  it('rejects an invalid inviteId', async () => {
    await expect(
      acceptMealShareInviteAction({
        inviteId: 'bad',
        loggedDate: '2026-04-05',
        timezoneOffset: -420,
      })
    ).rejects.toThrow();
  });
});

describe('dismissMealShareInviteAction', () => {
  beforeEach(() => vi.clearAllMocks());

  function queueUpdateReturning(rows: unknown[]) {
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(rows),
        }),
      }),
    });
  }

  it('throws when the invite is not mine or already handled', async () => {
    queueUpdateReturning([]);
    await expect(
      dismissMealShareInviteAction({ inviteId: UUID_INVITE })
    ).rejects.toThrow('Lời mời');
  });

  it('succeeds when a pending invite is dismissed', async () => {
    queueUpdateReturning([{ id: UUID_INVITE }]);
    const result = await dismissMealShareInviteAction({
      inviteId: UUID_INVITE,
    });
    expect(result).toEqual({ success: true });
  });

  it('rejects an invalid inviteId', async () => {
    await expect(
      dismissMealShareInviteAction({ inviteId: 'bad' })
    ).rejects.toThrow();
  });
});
