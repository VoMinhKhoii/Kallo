import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/infra/db/client', () => ({ db: {} }));

import {
  blockFriend,
  listBlockedUsers,
  unblockFriend,
} from '@/lib/actions/moderation/blocks';

// Valid v4 UUIDs, A < B so the canonical friendship pair is (A, B).
const A = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const B = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';

const render = (condition: unknown) =>
  new PgDialect().sqlToQuery(condition as SQL);

interface BlockRow {
  blockerId: string;
  blockedId: string;
}

/** The notifications columns the list, the badge and the cleanup read. */
interface NotificationRow {
  id: string;
  recipientId: string;
  actorIds: string[];
  createdAt: number;
  seen: boolean;
  data?: Record<string, unknown>;
}

/** Postgres array literal ('{"<uuid>"}') → its single element. */
const arrayParam = (value: unknown) => String(value).replace(/[{}"]/g, '');

/**
 * A tiny in-memory stand-in for the tables a block touches: user_blocks rows
 * keyed blocker→blocked, the pair's friendship, and notifications. Writes are
 * decided by the same values the real statements carry (the insert's values,
 * the delete's bound parameters), so the directional behaviour is exercised,
 * not just the call shape.
 */
function blockStore(
  initial: {
    friends?: boolean;
    blocks?: BlockRow[];
    notifications?: NotificationRow[];
  } = {}
) {
  const blocks = new Map(
    (initial.blocks ?? []).map((row) => [
      `${row.blockerId}>${row.blockedId}`,
      row,
    ])
  );
  const state = {
    friends: initial.friends ?? false,
    blocks,
    notifications: [...(initial.notifications ?? [])],
    clearCondition: undefined as unknown,
    events: [] as string[],
  };

  const tx = {
    execute: vi.fn(async (statement: SQL) => {
      const { sql } = render(statement);
      if (sql.includes('pg_advisory_xact_lock')) state.events.push('lock');
      return [];
    }),
    insert: vi.fn(() => ({
      values: (row: BlockRow) => ({
        onConflictDoNothing: async () => {
          state.events.push('insert-block');
          const key = `${row.blockerId}>${row.blockedId}`;
          if (!blocks.has(key)) blocks.set(key, row);
        },
      }),
    })),
    delete: vi.fn(() => ({
      where: async (condition: SQL) => {
        const { sql } = render(condition);
        if (sql.includes('"friendships"')) {
          state.events.push('end-friendship');
          state.friends = false;
        }
        if (sql.includes('"notifications"')) {
          // (recipient = $1 AND actor_ids @> {$2}) OR (recipient = $3 AND …)
          const { params } = render(condition);
          state.events.push('clear-notifications');
          state.clearCondition = condition;
          const pairs = [
            [params[0], arrayParam(params[1])],
            [params[2], arrayParam(params[3])],
          ];
          state.notifications = state.notifications.filter(
            (row) =>
              !pairs.some(
                ([recipient, actor]) =>
                  row.recipientId === recipient &&
                  row.actorIds.includes(actor as string)
              )
          );
        }
      },
    })),
  };

  const db = {
    transaction: vi.fn(async (run: (t: typeof tx) => unknown) => run(tx)),
    delete: vi.fn(() => ({
      where: (condition: SQL) => ({
        returning: async () => {
          const { params } = render(condition);
          const key = `${params[0]}>${params[1]}`;
          const row = blocks.get(key);
          if (!row) return [];
          blocks.delete(key);
          return [{ blockedId: row.blockedId }];
        },
      }),
    })),
  };
  return { db, tx, state };
}

// What the badge poll and the activity list read — plain recipient-scoped
// reads over the table (lib/actions/notifications/{state,list}.ts), with no
// block rule of their own. The block keeps them correct by what it deletes.
const C = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';

function note(
  id: string,
  recipientId: string,
  actorIds: string[],
  createdAt: number,
  data?: Record<string, unknown>
): NotificationRow {
  return { id, recipientId, actorIds, createdAt, seen: false, data };
}

function badge(rows: NotificationRow[], recipientId: string): number {
  return rows.filter((row) => row.recipientId === recipientId && !row.seen)
    .length;
}

function firstPage(
  rows: NotificationRow[],
  recipientId: string,
  limit: number
) {
  return rows
    .filter((row) => row.recipientId === recipientId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

describe('blockFriend', () => {
  it('records a directed block and ends the friendship, under the pair lock', async () => {
    const { db, state } = blockStore({ friends: true });

    await expect(
      blockFriend(A, { targetUserId: B }, db as never)
    ).resolves.toEqual({ status: 'blocked' });

    expect([...state.blocks.keys()]).toEqual([`${A}>${B}`]);
    expect(state.friends).toBe(false);
    // Lock first, so a concurrent accept cannot re-create the friendship.
    expect(state.events).toEqual([
      'lock',
      'insert-block',
      'end-friendship',
      'clear-notifications',
    ]);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it('deletes each side’s notifications about the other, so the badge drops them', async () => {
    const { db, state } = blockStore({
      notifications: [
        note('a-from-b', A, [B], 3),
        note('a-from-c', A, [C], 2),
        note('b-from-a', B, [A], 1),
        note('b-from-c', B, [C], 1),
      ],
    });
    expect(badge(state.notifications, A)).toBe(2);

    await blockFriend(A, { targetUserId: B }, db as never);

    // Both directions: the blocker's rows about B and B's rows about A.
    expect(badge(state.notifications, A)).toBe(1);
    expect(badge(state.notifications, B)).toBe(1);
    expect(state.notifications.map((row) => row.id)).toEqual([
      'a-from-c',
      'b-from-c',
    ]);
  });

  // A grouped share.reply keeps the LATEST actor's preview text in `data`;
  // removing only the actor id would leave the blocked person's words behind.
  it('deletes a grouped row the blocked person was part of, preview and all', async () => {
    const { db, state } = blockStore({
      notifications: [
        note('grouped', A, [B, C], 2, { previewBody: 'written by B' }),
        note('c-only', A, [C], 1),
      ],
    });

    await blockFriend(A, { targetUserId: B }, db as never);

    expect(state.notifications.map((row) => row.id)).toEqual(['c-only']);
    expect(JSON.stringify(state.notifications)).not.toContain('written by B');
  });

  // The rows are gone before any read, so a page is cut from visible rows
  // only: the newest rows being the blocked person's cannot empty page one.
  it('never leaves an empty first page while older visible rows exist', async () => {
    const { db, state } = blockStore({
      notifications: [
        ...[10, 9, 8, 7, 6].map((at) => note(`b-${at}`, A, [B], at)),
        ...[3, 2, 1].map((at) => note(`c-${at}`, A, [C], at)),
      ],
    });

    await blockFriend(A, { targetUserId: B }, db as never);

    expect(firstPage(state.notifications, A, 5).map((row) => row.id)).toEqual([
      'c-3',
      'c-2',
      'c-1',
    ]);
  });

  it('does not bring deleted notifications back on unblock', async () => {
    const { db, state } = blockStore({
      notifications: [note('a-from-b', A, [B], 1), note('a-from-c', A, [C], 1)],
    });

    await blockFriend(A, { targetUserId: B }, db as never);
    await unblockFriend(A, { targetUserId: B }, db as never);

    expect(state.blocks.size).toBe(0);
    expect(state.notifications.map((row) => row.id)).toEqual(['a-from-c']);
  });

  it('matches the pair in both directions by recipient and actor membership', async () => {
    const { db, state } = blockStore();

    await blockFriend(A, { targetUserId: B }, db as never);

    const { sql, params } = render(state.clearCondition);
    expect(sql).toBe(
      '(("notifications"."recipient_id" = $1 and "notifications"."actor_ids" @> $2) or ("notifications"."recipient_id" = $3 and "notifications"."actor_ids" @> $4))'
    );
    expect(params).toEqual([A, `{"${B}"}`, B, `{"${A}"}`]);
  });

  it('refuses to block yourself', async () => {
    const { db } = blockStore();
    await expect(
      blockFriend(A, { targetUserId: A }, db as never)
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', status: 400 });
    expect(db.transaction).not.toHaveBeenCalled();
  });
});

describe('unblockFriend', () => {
  it('lifts the actor’s own block', async () => {
    const { db, state } = blockStore({
      blocks: [{ blockerId: A, blockedId: B }],
    });

    await expect(
      unblockFriend(A, { targetUserId: B }, db as never)
    ).resolves.toEqual({ unblocked: true });
    expect(state.blocks.size).toBe(0);
  });

  // Two-sided block: each person holds their own row. One unblock must leave
  // the other person's block fully in force.
  it('a two-sided block survives one side unblocking', async () => {
    const { db, state } = blockStore();
    await blockFriend(A, { targetUserId: B }, db as never);
    await blockFriend(B, { targetUserId: A }, db as never);
    expect(state.blocks.size).toBe(2);

    await unblockFriend(A, { targetUserId: B }, db as never);

    expect([...state.blocks.keys()]).toEqual([`${B}>${A}`]);
    // A unblocking again finds nothing of theirs; B's block is not A's to lift.
    await expect(
      unblockFriend(A, { targetUserId: B }, db as never)
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect([...state.blocks.keys()]).toEqual([`${B}>${A}`]);
  });

  // The blocked person gets the same 404 as "no such block" — the endpoint
  // never reveals that the other side blocked them.
  it('404s the blocked person trying to lift the blocker’s block', async () => {
    const { db, state } = blockStore({
      blocks: [{ blockerId: A, blockedId: B }],
    });

    await expect(
      unblockFriend(B, { targetUserId: A }, db as never)
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(state.blocks.size).toBe(1);
  });

  it('targets the actor as blocker in SQL', async () => {
    let where: unknown;
    const db = {
      delete: vi.fn(() => ({
        where: (condition: unknown) => {
          where = condition;
          return { returning: async () => [{ blockedId: B }] };
        },
      })),
    };

    await unblockFriend(A, { targetUserId: B }, db as never);

    const { sql, params } = render(where);
    expect(sql).toContain('"user_blocks"."blocker_id" = $1');
    expect(sql).toContain('"user_blocks"."blocked_id" = $2');
    expect(params).toEqual([A, B]);
  });

  it('rejects a malformed or self target before touching the db', async () => {
    const { db } = blockStore();

    await expect(
      unblockFriend(A, { targetUserId: 'not-a-uuid' }, db as never)
    ).rejects.toThrow();
    await expect(
      unblockFriend(A, { targetUserId: A }, db as never)
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(db.delete).not.toHaveBeenCalled();
  });
});

describe('listBlockedUsers', () => {
  it('lists only rows where the actor is the blocker, as public profiles', async () => {
    const blockedAt = new Date('2026-09-20T08:00:00.000Z');
    let whereCondition: unknown;
    const chain = {
      innerJoin: vi.fn(() => chain),
      where: vi.fn((condition: unknown) => {
        whereCondition = condition;
        return chain;
      }),
      orderBy: vi.fn().mockResolvedValue([
        {
          userId: B,
          handle: 'phofan',
          displayName: 'Phở Fan',
          avatarSeed: 'phofan',
          avatarUrl: null,
          avatarPath: null,
          blockedAt,
        },
      ]),
    };
    const db = { select: vi.fn(() => ({ from: vi.fn(() => chain) })) };

    const blocked = await listBlockedUsers(A, db as never);

    expect(blocked).toEqual([
      {
        profile: expect.objectContaining({
          userId: B,
          handle: 'phofan',
          displayName: 'Phở Fan',
        }),
        blockedAt: blockedAt.toISOString(),
      },
    ]);
    const { sql, params } = render(whereCondition);
    expect(sql).toBe('"user_blocks"."blocker_id" = $1');
    expect(params).toEqual([A]);
  });
});
