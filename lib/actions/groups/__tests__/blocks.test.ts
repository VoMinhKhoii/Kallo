import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/infra/db/client', () => ({ db: {} }));

import {
  blockFriend,
  listBlockedUsers,
  unblockFriend,
} from '@/lib/actions/groups/blocks';

// Valid v4 UUIDs, ACTOR < TARGET so the canonical pair is (ACTOR, TARGET).
const ACTOR = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TARGET = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const EDGE_ID = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';

const render = (condition: unknown) =>
  new PgDialect().sqlToQuery(condition as SQL);

function insertDb() {
  const captured: {
    values?: Record<string, unknown>;
    set?: Record<string, unknown>;
  } = {};
  const db = {
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        captured.values = values;
        return {
          onConflictDoUpdate: vi.fn(
            (config: { set: Record<string, unknown> }) => {
              captured.set = config.set;
              return {
                returning: vi
                  .fn()
                  .mockResolvedValue([{ id: EDGE_ID, status: 'blocked' }]),
              };
            }
          ),
        };
      }),
    })),
  };
  return { db, captured };
}

function deleteDb(deletedRows: unknown[]) {
  const where = vi.fn((_condition: unknown) => ({
    returning: vi.fn().mockResolvedValue(deletedRows),
  }));
  const db = { delete: vi.fn(() => ({ where })) };
  return { db, where };
}

describe('blockFriend', () => {
  it('records the actor as the blocker on a fresh edge', async () => {
    const { db, captured } = insertDb();

    await expect(
      blockFriend(ACTOR, { targetUserId: TARGET }, db as never)
    ).resolves.toEqual({ friendshipId: EDGE_ID, status: 'blocked' });

    expect(captured.values).toMatchObject({
      userLow: ACTOR,
      userHigh: TARGET,
      status: 'blocked',
      blockedBy: ACTOR,
    });
  });

  // Being blocked must never let someone take over — and then lift — the
  // other person's block by "blocking back".
  it('keeps an existing blocker on conflict, claiming only unowned edges', async () => {
    const { db, captured } = insertDb();

    await blockFriend(TARGET, { targetUserId: ACTOR }, db as never);

    const { sql, params } = render(captured.set?.blockedBy);
    const flat = sql.replace(/\s+/g, ' ');
    expect(flat).toContain(
      `WHEN "friendships"."status" = 'blocked' AND "friendships"."blocked_by" IS NOT NULL THEN "friendships"."blocked_by"`
    );
    expect(flat).toContain('ELSE $1::uuid');
    expect(params).toEqual([TARGET]);
    expect(captured.set?.status).toBe('blocked');
  });

  it('refuses to block yourself', async () => {
    const { db } = insertDb();
    await expect(
      blockFriend(ACTOR, { targetUserId: ACTOR }, db as never)
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', status: 400 });
    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe('unblockFriend', () => {
  it('deletes only a blocked edge the actor placed', async () => {
    const { db, where } = deleteDb([{ id: EDGE_ID }]);

    await expect(
      unblockFriend(ACTOR, { targetUserId: TARGET }, db as never)
    ).resolves.toEqual({ unblocked: true });

    const { sql, params } = render(where.mock.calls[0]?.[0]);
    expect(sql).toContain('"friendships"."status" = $3');
    expect(sql).toContain('"friendships"."blocked_by" = $4');
    expect(params).toEqual([ACTOR, TARGET, 'blocked', ACTOR]);
  });

  // The blocked person (or anyone who did not place the block) matches no row
  // and gets the same 404 as "no block at all" — the endpoint never reveals
  // that the other side blocked you.
  it('404s when the actor did not place a block on this person', async () => {
    const { db } = deleteDb([]);

    await expect(
      unblockFriend(TARGET, { targetUserId: ACTOR }, db as never)
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('rejects a malformed or self target before touching the db', async () => {
    const { db } = deleteDb([]);

    await expect(
      unblockFriend(ACTOR, { targetUserId: 'not-a-uuid' }, db as never)
    ).rejects.toThrow();
    await expect(
      unblockFriend(ACTOR, { targetUserId: ACTOR }, db as never)
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(db.delete).not.toHaveBeenCalled();
  });
});

describe('listBlockedUsers', () => {
  it('lists only blocks the actor placed, as public profiles', async () => {
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
          userId: TARGET,
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

    const blocked = await listBlockedUsers(ACTOR, db as never);

    expect(blocked).toEqual([
      {
        profile: expect.objectContaining({
          userId: TARGET,
          handle: 'phofan',
          displayName: 'Phở Fan',
        }),
        blockedAt: blockedAt.toISOString(),
      },
    ]);
    const { sql, params } = render(whereCondition);
    expect(sql).toContain('"friendships"."blocked_by" = $2');
    expect(params).toEqual(['blocked', ACTOR]);
  });
});
