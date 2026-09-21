import { beforeEach, describe, expect, it, vi } from 'vitest';

// The sweep that deletes staged cards nobody came back to. It became worth
// testing when it started handing invites back: a card staged from a friend's
// cheat offer SPENT that offer at the moment it was taken, so reaping the card
// is the last chance anyone has to notice the offer went nowhere. Get this
// wrong and the recipient loses the meal and the sender can never re-send —
// which is the bug the discard path was fixed for, arriving a week late for
// anyone who walked away from the card instead of dismissing it.

const { mockTxDelete, mockTx, mockTransaction } = vi.hoisted(() => {
  const mockTxDelete = vi.fn();
  const mockTx = { delete: mockTxDelete, update: vi.fn() };
  return {
    mockTxDelete,
    mockTx,
    mockTransaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx)
    ),
  };
});

const { mockReleaseInvite } = vi.hoisted(() => ({
  mockReleaseInvite: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/infra/db/client', () => ({
  db: { transaction: mockTransaction },
}));
vi.mock(
  '@/lib/infra/db/schema',
  async () => (await import('../../__tests__/meal-doubles')).schema
);
vi.mock('@/lib/actions/meal-sharing/invite-lifecycle', () => ({
  releaseInvite: mockReleaseInvite,
}));

import { reapAbandonedPendingAnalyses } from '@/lib/actions/meals/day/reap-abandoned';
import { MOCK_USER, UUID_1, UUID_2 } from '../../__tests__/meal-doubles';

/** The sweep resolves through .where().returning(). */
function queueReap(rows: unknown[]) {
  const captured: { where?: unknown } = {};
  mockTxDelete.mockReturnValue({
    where: vi.fn((predicate: unknown) => {
      captured.where = predicate;
      return { returning: vi.fn().mockResolvedValue(rows) };
    }),
  });
  return captured;
}

describe('reapAbandonedPendingAnalyses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReleaseInvite.mockResolvedValue(true);
  });

  it('hands back every offer whose card it reaped', async () => {
    queueReap([
      { sourceInviteId: UUID_1 },
      { sourceInviteId: null },
      { sourceInviteId: UUID_2 },
    ]);

    await reapAbandonedPendingAnalyses(MOCK_USER.id);

    // Twice, not three times: a card the user staged themselves owes nothing.
    expect(mockReleaseInvite).toHaveBeenCalledTimes(2);
    expect(
      mockReleaseInvite.mock.calls.map((call) => call[1].inviteId)
    ).toEqual([UUID_1, UUID_2]);
  });

  it('releases as the card owner, inside the sweep transaction', async () => {
    // The release is scoped to the actor, and it has to run on the SAME tx as
    // the delete — an offer handed back after the delete committed, by a call
    // that then failed, would spend the card and the offer both.
    queueReap([{ sourceInviteId: UUID_1 }]);

    await reapAbandonedPendingAnalyses(MOCK_USER.id);

    expect(mockReleaseInvite).toHaveBeenCalledWith(mockTx, {
      inviteId: UUID_1,
      userId: MOCK_USER.id,
    });
  });

  it('scopes the sweep to the user and to cards a week past expiry', async () => {
    // Without the userId clause this reaps everyone's cards — Drizzle bypasses
    // RLS, so the predicate is the only tenant guard. Without the interval it
    // reaps cards 30 minutes old, which are still on the feed.
    const captured = queueReap([]);

    await reapAbandonedPendingAnalyses(MOCK_USER.id);

    const predicate = JSON.stringify(captured.where);
    expect(predicate).toContain('pendingAnalyses.userId');
    expect(predicate).toContain(MOCK_USER.id);
    expect(predicate).toContain("interval '7 days'");
  });

  it('touches no invite when nothing was abandoned', async () => {
    queueReap([]);

    await reapAbandonedPendingAnalyses(MOCK_USER.id);

    expect(mockReleaseInvite).not.toHaveBeenCalled();
  });

  it('never throws — a failed sweep must not cost someone their day', async () => {
    // `loadLoggingDay` runs this in a Promise.all beside the reads it actually
    // needs. A rejection here would 500 the whole day over a cleanup nobody
    // asked for.
    mockTransaction.mockRejectedValueOnce(new Error('connection lost'));

    await expect(
      reapAbandonedPendingAnalyses(MOCK_USER.id)
    ).resolves.toBeUndefined();
  });

  it('swallows a failing release the same way', async () => {
    queueReap([{ sourceInviteId: UUID_1 }]);
    mockReleaseInvite.mockRejectedValueOnce(new Error('deadlock'));

    await expect(
      reapAbandonedPendingAnalyses(MOCK_USER.id)
    ).resolves.toBeUndefined();
  });
});
