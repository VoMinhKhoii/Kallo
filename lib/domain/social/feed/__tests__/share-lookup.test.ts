import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// The single-share read must not carry its own copy of the visibility rules —
// it must ask the one gate every cross-user share read goes through. These
// tests pin the delegation, not a second transcription of the predicates (the
// SQL itself is pinned in shares/__tests__/share-visibility.test.ts).
// ---------------------------------------------------------------------------

vi.mock('@/lib/infra/db/client', () => ({ db: {} }));

import { sharedMealVisibleToActor } from '@/lib/domain/social/feed/share-lookup';

const ACTOR = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OWNER = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const SHARE_ID = '3f1d2c4b-5a6e-4f70-8b91-0c2d3e4f5a6b';

const sharedAt = new Date('2026-05-03T08:00:00Z');

const row = {
  friendUserId: OWNER,
  mealId: 'meal-1',
  shareId: SHARE_ID,
  rawInput: 'bún chả',
  caloriesKcal: 640,
  proteinG: 30,
  carbohydrateG: 70,
  fatG: 20,
  portionFactor: 1,
  sharedAt,
  loggedAt: sharedAt,
  sharedAtText: sharedAt.toISOString(),
  handle: 'phofan',
  displayName: 'Phở Fan',
  avatarSeed: 'phofan',
  avatarUrl: null,
  avatarPath: null,
};

/**
 * One double for both halves of the read: `execute` answers the visibility
 * gate (which renders through `db.execute`), `select().from().innerJoin()
 * .innerJoin().where().limit()` answers the row projection. The row is always
 * present in this fake database — whether it comes back is the gate's call.
 */
function fakeDb(visible: boolean) {
  const captured: { statement?: SQL } = {};
  const execute = vi.fn((statement: SQL) => {
    captured.statement = statement;
    return Promise.resolve([{ visible }]);
  });

  const query = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue([row]),
  };
  query.from.mockReturnValue(query);
  query.innerJoin.mockReturnValue(query);
  query.where.mockReturnValue(query);
  const select = vi.fn().mockReturnValue(query);

  return { select, execute, captured, query };
}

describe('sharedMealVisibleToActor', () => {
  it('returns the row the gate admits', async () => {
    const db = fakeDb(true);

    await expect(
      sharedMealVisibleToActor(ACTOR, SHARE_ID, db as never)
    ).resolves.toEqual(row);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it('returns null without reading the row when the gate refuses', async () => {
    const db = fakeDb(false);

    await expect(
      sharedMealVisibleToActor(ACTOR, SHARE_ID, db as never)
    ).resolves.toBeNull();
    // Not "filtered out after the fact": the meal never leaves the database.
    expect(db.select).not.toHaveBeenCalled();
  });

  it('refuses a share whose only tie is a stale direct-chat membership', async () => {
    // The hole this delegation closes. removeFriend / blockFriend leave the
    // pair's `chat_group_members` rows behind, so a blocked viewer still shares
    // a `kind: 'direct'` group with the owner, both joined before the share.
    // The gate answers false for exactly that shape because its membership
    // EXISTS is restricted to named groups — a predicate restated here would
    // have to remember to, and the old one did not.
    const db = fakeDb(false);

    await expect(
      sharedMealVisibleToActor(ACTOR, SHARE_ID, db as never)
    ).resolves.toBeNull();

    const { sql } = new PgDialect().sqlToQuery(db.captured.statement as SQL);
    expect(sql).toContain('"chat_groups"."kind"');
    expect(sql).toContain("'group'");
  });

  it('asks the gate about this actor and this share', async () => {
    const db = fakeDb(true);

    await sharedMealVisibleToActor(ACTOR, SHARE_ID, db as never);

    const { params } = new PgDialect().sqlToQuery(db.captured.statement as SQL);
    expect(params).toContain(ACTOR);
    expect(params).toContain(SHARE_ID);
  });
});
