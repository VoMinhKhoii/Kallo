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

/**
 * A tiny in-memory stand-in for the two tables a block touches: user_blocks
 * rows keyed blocker→blocked, and the pair's friendship. Writes are decided
 * by the same values the real statements carry (the insert's values, the
 * delete's bound parameters), so the directional behaviour is exercised, not
 * just the call shape.
 */
function blockStore(initial: { friends?: boolean; blocks?: BlockRow[] } = {}) {
  const blocks = new Map(
    (initial.blocks ?? []).map((row) => [
      `${row.blockerId}>${row.blockedId}`,
      row,
    ])
  );
  const state = {
    friends: initial.friends ?? false,
    blocks,
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

describe('blockFriend', () => {
  it('records a directed block and ends the friendship, under the pair lock', async () => {
    const { db, state } = blockStore({ friends: true });

    await expect(
      blockFriend(A, { targetUserId: B }, db as never)
    ).resolves.toEqual({ status: 'blocked' });

    expect([...state.blocks.keys()]).toEqual([`${A}>${B}`]);
    expect(state.friends).toBe(false);
    // Lock first, so a concurrent accept cannot re-create the friendship.
    expect(state.events).toEqual(['lock', 'insert-block', 'end-friendship']);
    expect(db.transaction).toHaveBeenCalledTimes(1);
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
