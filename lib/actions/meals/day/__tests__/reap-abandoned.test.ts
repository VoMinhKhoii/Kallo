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

// Staged-card ids, deliberately distinct from the invite ids above: a card and
// the offer it was staged from are different rows, and a test that reused one
// id for both could not tell `reapedIds` from the ids passed to releaseInvite.
const CARD_A = 'd3bbce22-cf3e-4bb1-9e90-9eecef613d44';
const CARD_B = 'e4ccdf33-d04f-4cc2-af01-affdfa724e55';
const CARD_C = 'f5ddea44-e15a-4dd3-b012-b00e0b835f66';

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
      { id: CARD_A, sourceInviteId: UUID_1 },
      { id: CARD_B, sourceInviteId: null },
      { id: CARD_C, sourceInviteId: UUID_2 },
    ]);

    await reapAbandonedPendingAnalyses(MOCK_USER.id);

    // Twice, not three times: a card the user staged themselves owes nothing.
    expect(mockReleaseInvite).toHaveBeenCalledTimes(2);
    expect(
      mockReleaseInvite.mock.calls.map((call) => call[1].inviteId)
    ).toEqual([UUID_1, UUID_2]);
  });

  it('reports every id it deleted, so the day load can subtract them', async () => {
    // `loadLoggingDay` reads pending cards CONCURRENTLY with this sweep and
    // does not filter on expiry, so it can hold a row this sweep is deleting.
    // Without these ids it renders a card that no longer exists, and every
    // confirm or discard on it fails as "already saved / not found".
    queueReap([
      { id: CARD_A, sourceInviteId: UUID_1 },
      { id: CARD_B, sourceInviteId: null },
    ]);

    const outcome = await reapAbandonedPendingAnalyses(MOCK_USER.id);

    // Every reaped id, not just the ones that owed an invite.
    expect(outcome.reapedIds).toEqual([CARD_A, CARD_B]);
  });

  it('reports a release so the caller can refresh the inbox', async () => {
    queueReap([{ id: CARD_A, sourceInviteId: UUID_1 }]);

    const outcome = await reapAbandonedPendingAnalyses(MOCK_USER.id);

    expect(outcome.releasedInvites).toBe(true);
  });

  it('reports no release when the reaped cards owed nothing', async () => {
    // The flag drives a cache invalidation on both clients. Setting it for a
    // sweep that released nothing spends a request on every day load that
    // happens to reap an ordinary abandoned card.
    queueReap([{ id: CARD_A, sourceInviteId: null }]);

    const outcome = await reapAbandonedPendingAnalyses(MOCK_USER.id);

    expect(outcome.releasedInvites).toBe(false);
    expect(mockReleaseInvite).not.toHaveBeenCalled();
  });

  it('releases as the card owner, inside the sweep transaction', async () => {
    // The release is scoped to the actor, and it has to run on the SAME tx as
    // the delete — an offer handed back after the delete committed, by a call
    // that then failed, would spend the card and the offer both.
    queueReap([{ id: CARD_A, sourceInviteId: UUID_1 }]);

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

    // Reports nothing reaped, which is the TRUTHFUL answer and not merely a
    // safe one: the rows are still there, so the day must still show them.
    // Claiming ids here would blank live cards out of the feed.
    await expect(reapAbandonedPendingAnalyses(MOCK_USER.id)).resolves.toEqual({
      reapedIds: [],
      releasedInvites: false,
    });
  });

  it('swallows a failing release the same way', async () => {
    queueReap([{ id: CARD_A, sourceInviteId: UUID_1 }]);
    mockReleaseInvite.mockRejectedValueOnce(new Error('deadlock'));

    await expect(reapAbandonedPendingAnalyses(MOCK_USER.id)).resolves.toEqual({
      reapedIds: [],
      releasedInvites: false,
    });
  });
});
