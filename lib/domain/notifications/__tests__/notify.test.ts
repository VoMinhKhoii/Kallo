// The SQL-level aggregation semantics (dedup + cap 3, actor_count growing only
// for a new actor, the seen_at/created_at reset) live in the ON CONFLICT SET
// clause and are enforced by the partial unique index — they cannot execute
// without a database, and are covered by the constraint design rather than
// here. What IS testable in isolation, and what this suite pins, is the input
// shaping: which inputs reach the statement at all, how conflicting keys are
// spread across statements, what notify() reports back, and the guards that
// make retractActor a no-op.

import { describe, expect, it, vi } from 'vitest';
import { notify, retractActor } from '@/lib/domain/notifications/notify';
import type { NotifyInput } from '@/lib/domain/notifications/types';

const OWNER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ACTOR = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const OTHER = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';

interface InsertedRow {
  recipientId: string;
  actorIds: string[];
  groupKey: string;
}

/** A tx double capturing every insert batch and returning one row per value. */
function insertingTx() {
  const batches: InsertedRow[][] = [];
  const insert = vi.fn(() => ({
    values: (rows: InsertedRow[]) => {
      batches.push(rows);
      return {
        onConflictDoUpdate: () => ({
          returning: () =>
            Promise.resolve(
              rows.map((row) => ({ recipientId: row.recipientId }))
            ),
        }),
      };
    },
  }));
  return { tx: { insert } as never, batches, insert };
}

function input(overrides: Partial<NotifyInput> = {}): NotifyInput {
  return {
    recipientId: OWNER,
    type: 'share.reaction',
    actorId: ACTOR,
    groupKey: 'share.reaction:share-1',
    ...overrides,
  };
}

describe('notify', () => {
  it('drops self-notifications before touching the database', async () => {
    const { tx, insert } = insertingTx();

    const notified = await notify(tx, [
      input({ recipientId: ACTOR, actorId: ACTOR }),
    ]);

    expect(notified).toEqual([]);
    expect(insert).not.toHaveBeenCalled();
  });

  it('keeps the non-self recipients of a mixed fan-out', async () => {
    const { tx, batches } = insertingTx();

    const notified = await notify(tx, [
      input({ recipientId: OWNER }),
      input({ recipientId: ACTOR }),
      input({ recipientId: OTHER, groupKey: 'share.reply:share-1' }),
    ]);

    expect(notified).toEqual([OWNER, OTHER]);
    expect(batches[0].map((row) => row.recipientId)).toEqual([OWNER, OTHER]);
  });

  it('seeds each row with exactly one actor', async () => {
    const { tx, batches } = insertingTx();

    await notify(tx, [input()]);

    expect(batches[0][0].actorIds).toEqual([ACTOR]);
  });

  it('returns each recipient once even across several rows', async () => {
    const { tx } = insertingTx();

    const notified = await notify(tx, [
      input({ groupKey: 'share.reaction:a' }),
      input({ groupKey: 'share.reply:b' }),
    ]);

    expect(notified).toEqual([OWNER]);
  });

  // Postgres refuses to let one statement update the same conflict row twice.
  it('spreads inputs colliding on (recipient, groupKey) across statements', async () => {
    const { tx, batches } = insertingTx();

    await notify(tx, [
      input({ actorId: ACTOR }),
      input({ actorId: OTHER }),
      input({ groupKey: 'share.reply:share-1' }),
    ]);

    expect(batches).toHaveLength(2);
    // First statement: one row per distinct key. Second: the collider only.
    expect(batches[0].map((row) => row.groupKey)).toEqual([
      'share.reaction:share-1',
      'share.reply:share-1',
    ]);
    expect(batches[1].map((row) => row.actorIds[0])).toEqual([OTHER]);
  });

  it('is a no-op for an empty input list', async () => {
    const { tx, insert } = insertingTx();
    await expect(notify(tx, [])).resolves.toEqual([]);
    expect(insert).not.toHaveBeenCalled();
  });
});

/** A tx double whose UPDATE ... RETURNING yields the given rows. */
function retractingTx(updated: { id: string; actorCount: number }[]) {
  const del = vi.fn(() => ({ where: () => Promise.resolve(undefined) }));
  const update = vi.fn(() => ({
    set: () => ({
      where: () => ({ returning: () => Promise.resolve(updated) }),
    }),
  }));
  return { tx: { update, delete: del } as never, update, del };
}

describe('retractActor', () => {
  it('deletes the aggregate once its last actor leaves', async () => {
    const { tx, del } = retractingTx([{ id: 'notification-1', actorCount: 0 }]);

    await retractActor(tx, {
      recipientId: OWNER,
      groupKey: 'share.reaction:share-1',
      actorId: ACTOR,
    });

    expect(del).toHaveBeenCalledTimes(1);
  });

  it('keeps a row that still has other actors', async () => {
    const { tx, del } = retractingTx([{ id: 'notification-1', actorCount: 2 }]);

    await retractActor(tx, {
      recipientId: OWNER,
      groupKey: 'share.reaction:share-1',
      actorId: ACTOR,
    });

    expect(del).not.toHaveBeenCalled();
  });

  // No open row (already read/dismissed), or an actor who has aged out of the
  // three-deep list: the guarded UPDATE matches nothing and nothing follows.
  it('does nothing when the guarded update matches no row', async () => {
    const { tx, update, del } = retractingTx([]);

    await retractActor(tx, {
      recipientId: OWNER,
      groupKey: 'share.reaction:share-1',
      actorId: OTHER,
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(del).not.toHaveBeenCalled();
  });
});
