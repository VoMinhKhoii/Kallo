// The SQL-level aggregation semantics (dedup into the full actor membership,
// actor_count derived from it, the seen_at/created_at reset) live in the ON
// CONFLICT SET clause and are enforced by the partial unique index — they
// cannot execute without a database, and are covered by the constraint design
// rather than here. What IS testable in isolation, and what this suite pins, is
// the input shaping: which inputs reach the statement at all, how conflicting
// keys are spread across statements, what notify() reports back (the push set:
// inserts and seen→unseen re-badges, never a silent refresh), and the guards
// that make retractActor a no-op.

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

interface OpenRow {
  recipientId: string;
  groupKey: string;
  seenAt: Date | null;
}

const keyOf = (row: { recipientId: string; groupKey: string }) =>
  `${row.recipientId}:${row.groupKey}`;

/** A tx double standing in for the open-aggregate table. `open` seeds the rows
 *  that already exist with `read_at`/`dismissed_at` null, each with its
 *  `seen_at`: the pre-select reads exactly that state, and the upsert reports
 *  `inserted` (Postgres's `xmax = 0`) for every key not already there, then
 *  records the key as open-and-unseen — so a later round in the same call sees
 *  what the earlier one wrote, as it would in a real transaction. */
function insertingTx(open: OpenRow[] = []) {
  const batches: InsertedRow[][] = [];
  const state = new Map(open.map((row) => [keyOf(row), row]));
  const select = vi.fn(() => ({
    from: () => ({ where: () => Promise.resolve([...state.values()]) }),
  }));
  const insert = vi.fn(() => ({
    values: (rows: InsertedRow[]) => {
      batches.push(rows);
      return {
        onConflictDoUpdate: () => ({
          returning: () => {
            const returned = rows.map((row) => ({
              recipientId: row.recipientId,
              groupKey: row.groupKey,
              inserted: !state.has(keyOf(row)),
            }));
            for (const row of rows) {
              state.set(keyOf(row), {
                recipientId: row.recipientId,
                groupKey: row.groupKey,
                seenAt: null,
              });
            }
            return Promise.resolve(returned);
          },
        }),
      };
    },
  }));
  return { tx: { select, insert } as never, batches, insert, select };
}

const SEEN_AT = new Date('2026-08-28T10:00:00.000Z');

function openRow(overrides: Partial<OpenRow> = {}): OpenRow {
  return {
    recipientId: OWNER,
    groupKey: 'share.reaction:share-1',
    seenAt: null,
    ...overrides,
  };
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

  // The push gate, all three outcomes: one buzz per open aggregate PER VISIT
  // CYCLE. Insert knocks; a re-badge of a row the recipient has already looked
  // at knocks again; a refresh of a row still waiting to be looked at is silent.
  it('pushes when the event opens a fresh aggregate', async () => {
    const { tx } = insertingTx();

    await expect(notify(tx, [input()])).resolves.toEqual([OWNER]);
  });

  it('pushes when the event re-badges a row the recipient had seen', async () => {
    const { tx, insert } = insertingTx([openRow({ seenAt: SEEN_AT })]);

    const notified = await notify(tx, [input()]);

    expect(notified).toEqual([OWNER]);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the event only refreshes a still-unseen row', async () => {
    const { tx, insert } = insertingTx([openRow({ seenAt: null })]);

    const notified = await notify(tx, [input()]);

    expect(notified).toEqual([]);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('reports only the push-eligible recipients of a fan-out', async () => {
    const { tx } = insertingTx([
      openRow({ recipientId: OTHER, groupKey: 'share.reply:share-1' }),
    ]);

    const notified = await notify(tx, [
      input({ recipientId: OWNER }),
      input({ recipientId: OTHER, groupKey: 'share.reply:share-1' }),
    ]);

    expect(notified).toEqual([OWNER]);
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

  // No open row (already read/dismissed), or an actor who was never part of
  // this aggregate: the guarded UPDATE matches nothing and nothing follows.
  // Nobody ages out of the actor array, so membership is the only question.
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
