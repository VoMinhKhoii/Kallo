import { beforeEach, describe, expect, it, vi } from 'vitest';

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
// Mocks — db.* is the singleton (dismiss writes through it); tx.* is the
// transaction handle accept opens. Both are distinct mocks so lookups never
// collide.
// ---------------------------------------------------------------------------

const { mockTxSelect, mockTxUpdate, mockTxInsert, mockDbUpdate, mockTx } =
  vi.hoisted(() => {
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
      mockDbUpdate: vi.fn(),
      mockTx: {
        select: mockTxSelect,
        update: mockTxUpdate,
        insert: mockTxInsert,
      },
    };
  });

// The accept side is deliberately UNGATED (see share-with-friends: a split has
// already halved the sender's meal). Mocked only so this suite can prove the
// gate module is never reached.
const assertFeatureAccess = vi.hoisted(() => vi.fn());
vi.mock('@/lib/domain/billing/feature-gate', () => ({ assertFeatureAccess }));

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
    update: mockDbUpdate,
  },
}));

vi.mock(
  '@/lib/infra/db/schema',
  async () => (await import('./share-doubles')).schema
);

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import {
  acceptMealShareInviteAction,
  dismissMealShareInviteAction,
} from '@/lib/actions/meal-sharing/invite-response';
import {
  MOCK_USER as mockUser,
  routeInserts,
  sourceItem,
  sourceMeal,
  txQueues,
  UUID_FRIEND,
  UUID_INVITE,
  UUID_ITEM,
  UUID_MEAL,
  UUID_NEW,
} from './share-doubles';

const { queueLimitSelect, queueWhereSelect, installUpdate } = txQueues(
  mockTxSelect,
  mockTxUpdate
);

describe('acceptMealShareInviteAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects when the invite cannot be claimed (tenant safety / race)', async () => {
    queueLimitSelect([{ sourceMealId: UUID_MEAL, fromUserId: UUID_FRIEND }]);
    queueLimitSelect([sourceMeal()]);
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
    queueLimitSelect([{ sourceMealId: UUID_MEAL, fromUserId: UUID_FRIEND }]);
    queueLimitSelect([sourceMeal()]);
    installUpdate({ returning: [{ id: UUID_INVITE }] });
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
    queueLimitSelect([{ sourceMealId: UUID_MEAL, fromUserId: UUID_FRIEND }]);
    queueLimitSelect([sourceMeal({ portionFactor: 0.5, caloriesKcal: 100 })]); // the sender's split share, row-locked before claim
    installUpdate({ returning: [{ id: UUID_INVITE }] });
    queueLimitSelect([{ id: 'friendship-1' }]); // still friends
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

describe('the recipient side stays free', () => {
  // The INITIATOR pays. A gated accept would strand a premium sender: a split
  // has ALREADY halved their meal by the time the invite exists, so a 402 here
  // would silently eat the other half against an offer nobody can take. Do not
  // "fix" this by adding a gate.
  beforeEach(() => vi.clearAllMocks());

  it('completes a full accept without ever consulting the feature gate', async () => {
    queueLimitSelect([{ sourceMealId: UUID_MEAL, fromUserId: UUID_FRIEND }]);
    queueLimitSelect([sourceMeal({ portionFactor: 0.5, caloriesKcal: 100 })]);
    installUpdate({ returning: [{ id: UUID_INVITE }] });
    queueLimitSelect([{ id: 'friendship-1' }]);
    queueWhereSelect([sourceItem({ estimatedGrams: 200, caloriesKcal: 100 })]);
    mockTxInsert.mockImplementation(routeInserts({}));

    await acceptMealShareInviteAction({
      inviteId: UUID_INVITE,
      newMealId: UUID_NEW,
      loggedDate: '2026-04-05',
      timezoneOffset: -420,
    });

    expect(assertFeatureAccess).not.toHaveBeenCalled();
  });

  it('dismisses an invite without ever consulting the feature gate', async () => {
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: UUID_INVITE }]),
        }),
      }),
    });

    await expect(
      dismissMealShareInviteAction({ inviteId: UUID_INVITE })
    ).resolves.toEqual({ success: true });

    expect(assertFeatureAccess).not.toHaveBeenCalled();
  });
});
