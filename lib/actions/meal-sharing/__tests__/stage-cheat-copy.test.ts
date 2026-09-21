import { beforeEach, describe, expect, it, vi } from 'vitest';

// Taking a cheat invite reopens the SENDER's sliders instead of copying their
// numbers. Two things here are load-bearing and silent when wrong: the invite
// must be consumed exactly once (or one offer becomes two logged meals), and
// the staged card must open on the sender's chosen amounts (or the feature is
// just "log a cheat meal", with the share contributing nothing).

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

const { mockTxSelect, mockTxUpdate, mockTxInsert, mockTx } = vi.hoisted(() => {
  const mockTxSelect = vi.fn();
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

import { stageCheatInviteAction } from '@/lib/actions/meal-sharing/stage-cheat-copy';
import { FeatureLockedError } from '@/lib/core/errors/app-error';
import {
  capturedPredicates,
  cheatSourceMeal,
  LOGGED_AT,
  MOCK_USER,
  txQueues,
  UUID_FRIEND,
  UUID_INVITE,
  UUID_MEAL,
} from './share-doubles';

const { queueLimitSelect, installUpdate } = txQueues(
  mockTxSelect,
  mockTxUpdate
);

const ANALYSIS_ID = 'aa11bb22-cc33-4dd4-8ee5-ff6677889900';
const pendingInvite = {
  sourceMealId: UUID_MEAL,
  fromUserId: UUID_FRIEND,
};

/** Captures the staged pending_analyses row. */
function captureStage() {
  const captured: { staged?: Record<string, unknown> } = {};
  mockTxInsert.mockImplementation(() => ({
    values: vi.fn((vals: unknown) => {
      captured.staged = vals as Record<string, unknown>;
      return { returning: vi.fn().mockResolvedValue([{ id: ANALYSIS_ID }]) };
    }),
  }));
  return captured;
}

/** The happy path's four queued reads, in the order the action issues them. */
function queueHappyPath() {
  queueLimitSelect([pendingInvite]);
  queueLimitSelect([cheatSourceMeal()]);
  installUpdate({ returning: [{ id: UUID_INVITE }] });
  queueLimitSelect([{ id: 'friendship-1' }]);
}

describe('stageCheatInviteAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedPredicates.length = 0;
  });

  it('scopes every read and write to the actor', async () => {
    // Drizzle bypasses RLS, so these predicates ARE the authorization. Drop
    // `toUserId = me` from the discovery select or the claim, or
    // `meals.userId = sender` from the source read, and this is the only
    // thing standing between a stranger and someone else's meal.
    queueHappyPath();
    captureStage();

    await stageCheatInviteAction({ inviteId: UUID_INVITE });

    const [discovery, source, claim, friendship] = capturedPredicates;
    // The invite must be MINE and still pending.
    expect(discovery).toContain('mealShareInvites.toUserId');
    expect(discovery).toContain(MOCK_USER.id);
    expect(discovery).toContain('mealShareInvites.status');
    // The cross-user meal read is bounded to the invite's sender.
    expect(source).toContain('meals.userId');
    expect(source).toContain(UUID_FRIEND);
    // The claim re-scopes rather than trusting the discovery read.
    expect(claim).toContain('mealShareInvites.toUserId');
    expect(claim).toContain(MOCK_USER.id);
    // The friendship is re-checked against me, in both edge orderings.
    expect(friendship).toContain(MOCK_USER.id);
    expect(friendship).toContain('friendships.status');
  });

  it("opens the card on the sender's amounts, not the model's defaults", async () => {
    queueHappyPath();
    const captured = captureStage();

    const result = await stageCheatInviteAction({ inviteId: UUID_INVITE });

    // The sender dialled protein to 8; the fixture's spec still declares a
    // default of 4. Carrying their choice across as MY starting position is
    // the entire point — without it the share tells me nothing about what we
    // actually ate.
    expect(result.spec.sliders[0]?.defaultLevel).toBe(8);
    const staged = captured.staged as Record<string, unknown>;
    const pipelineResult = staged.pipelineResult as {
      entryMode: string;
      spec: { sliders: { defaultLevel: number }[] };
    };
    expect(pipelineResult.entryMode).toBe('cheat');
    expect(pipelineResult.spec.sliders[0]?.defaultLevel).toBe(8);
    expect(staged.entryMode).toBe('cheat');
    expect(staged.rawInput).toBe('Buffet nướng');
    expect(result.analysisId).toBe(ANALYSIS_ID);
  });

  it("stamps the staged row at the source meal's instant", async () => {
    queueHappyPath();
    const captured = captureStage();

    const result = await stageCheatInviteAction({ inviteId: UUID_INVITE });

    // Same eating event seen from my diary — matching what an accepted precise
    // copy does, and keeping the row's time consistent with the sender's
    // mealSlot that rides along inside the spec.
    expect(captured.staged?.loggedAt).toEqual(LOGGED_AT);
    expect(result.loggedAt).toBe(LOGGED_AT.toISOString());
  });

  it('never writes acceptedMealId — there is no meal yet', async () => {
    queueHappyPath();
    const captures: Record<string, unknown>[] = [];
    mockTxUpdate.mockImplementation(() => ({
      set: (vals: Record<string, unknown>) => {
        captures.push(vals);
        return {
          where: () =>
            Object.assign(Promise.resolve(undefined), {
              returning: () => Promise.resolve([{ id: UUID_INVITE }]),
            }),
        };
      },
    }));
    captureStage();

    await stageCheatInviteAction({ inviteId: UUID_INVITE });

    expect(captures).toHaveLength(1);
    expect(captures[0]).toMatchObject({ status: 'accepted' });
    expect(captures[0]).not.toHaveProperty('acceptedMealId');
  });

  it('consumes the invite exactly once — a second tap stages nothing', async () => {
    queueLimitSelect([pendingInvite]);
    queueLimitSelect([cheatSourceMeal()]);
    // The guarded UPDATE matches no row: someone already claimed it.
    installUpdate({ returning: [] });
    const captured = captureStage();

    await expect(
      stageCheatInviteAction({ inviteId: UUID_INVITE })
    ).rejects.toThrow('đã được xử lý');

    // The real guarantee: losing the claim must not leave a staged card
    // behind, or the loser of the race logs a meal against a spent offer.
    expect(captured.staged).toBeUndefined();
  });

  it('refuses an invite that is not mine or no longer pending', async () => {
    queueLimitSelect([]);
    const captured = captureStage();

    await expect(
      stageCheatInviteAction({ inviteId: UUID_INVITE })
    ).rejects.toThrow('Lời mời không tồn tại');

    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(captured.staged).toBeUndefined();
  });

  it('refuses a precise source — that one accepts, it does not re-stage', async () => {
    queueLimitSelect([pendingInvite]);
    queueLimitSelect([cheatSourceMeal({ entryMode: 'precise' })]);
    const captured = captureStage();

    await expect(
      stageCheatInviteAction({ inviteId: UUID_INVITE })
    ).rejects.toThrow('không phải bữa xả');

    // Refused BEFORE the claim, so the invite survives and can still be taken
    // through the right path.
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(captured.staged).toBeUndefined();
  });

  it('refuses a cheat source whose slider payload is gone', async () => {
    queueLimitSelect([pendingInvite]);
    queueLimitSelect([cheatSourceMeal({ cheatSliders: null })]);
    const captured = captureStage();

    await expect(
      stageCheatInviteAction({ inviteId: UUID_INVITE })
    ).rejects.toThrow('không phải bữa xả');

    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(captured.staged).toBeUndefined();
  });

  it('refuses once the friendship is gone, rolling the claim back', async () => {
    queueLimitSelect([pendingInvite]);
    queueLimitSelect([cheatSourceMeal()]);
    installUpdate({ returning: [{ id: UUID_INVITE }] });
    queueLimitSelect([]); // unfriended since the offer was made
    const captured = captureStage();

    await expect(
      stageCheatInviteAction({ inviteId: UUID_INVITE })
    ).rejects.toThrow('không còn là bạn bè');

    // Throwing inside the transaction is what undoes the claim; nothing was
    // staged, so there is no orphan card either.
    expect(captured.staged).toBeUndefined();
  });

  it('tells the sender their offer landed, and closes my own card', async () => {
    queueHappyPath();
    captureStage();

    await stageCheatInviteAction({ inviteId: UUID_INVITE });

    expect(mockCloseAggregates).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledTimes(1);
    const events = mockNotify.mock.lastCall?.[1] as Array<
      Record<string, unknown>
    >;
    expect(events[0]).toMatchObject({
      recipientId: UUID_FRIEND,
      type: 'share.invite_accepted',
      objectId: UUID_INVITE,
    });
  });

  it('meets the cheat paywall BEFORE spending the invite', async () => {
    // The trap this guards: confirming a cheat meal is already gated, so a
    // free user who got as far as the slider card would dial four sliders and
    // only then be refused — with the offer already consumed.
    assertFeatureAccess.mockRejectedValueOnce(
      new FeatureLockedError('cheat_meal', 'not_entitled', 'locked')
    );
    const captured = captureStage();

    await expect(
      stageCheatInviteAction({ inviteId: UUID_INVITE })
    ).rejects.toBeInstanceOf(FeatureLockedError);

    expect(assertFeatureAccess).toHaveBeenCalledWith(
      expect.anything(),
      'cheat_meal'
    );
    // Nothing was read, claimed or staged — the transaction never opened.
    expect(mockTxSelect).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(captured.staged).toBeUndefined();
  });

  it('rejects a malformed inviteId before touching the database', async () => {
    await expect(
      stageCheatInviteAction({ inviteId: 'not-a-uuid' })
    ).rejects.toThrow();
    expect(mockTxSelect).not.toHaveBeenCalled();
  });
});
