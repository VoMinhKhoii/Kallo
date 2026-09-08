import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// The single-share read must not carry its own copy of the visibility rules —
// it must carry the one predicate every cross-user share read goes through, in
// its own WHERE. These tests pin that composition (admission and read are one
// statement), not a second transcription of the predicates: the SQL of the
// predicate itself is pinned in shares/__tests__/share-visibility.test.ts.
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
 * One statement, one double: `select().from().innerJoin().innerJoin().where()
 * .limit()`. What Postgres would decide is the WHERE this fake captures, so
 * "the gate refused" is arranged the way the database expresses it — an empty
 * result — rather than by a separate boolean.
 */
function fakeDb(rows: unknown[]) {
  const captured: { where?: SQL } = {};
  const query = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  query.from.mockReturnValue(query);
  query.innerJoin.mockReturnValue(query);
  query.where.mockImplementation((predicate: SQL) => {
    captured.where = predicate;
    return query;
  });
  const select = vi.fn().mockReturnValue(query);
  const execute = vi.fn();

  return { select, execute, captured, query };
}

const compile = (predicate: SQL | undefined) =>
  new PgDialect().sqlToQuery(predicate as SQL);

describe('sharedMealVisibleToActor', () => {
  it('returns the row the predicate admits', async () => {
    const db = fakeDb([row]);

    await expect(
      sharedMealVisibleToActor(ACTOR, SHARE_ID, db as never)
    ).resolves.toEqual(row);
  });

  it('returns null when the predicate refuses the row', async () => {
    // Not "filtered out after the fact": the predicate is part of the read, so
    // an inadmissible meal never leaves the database.
    const db = fakeDb([]);

    await expect(
      sharedMealVisibleToActor(ACTOR, SHARE_ID, db as never)
    ).resolves.toBeNull();
  });

  it('decides admission and reads the row in one statement', async () => {
    const db = fakeDb([row]);

    await sharedMealVisibleToActor(ACTOR, SHARE_ID, db as never);

    // Exactly one query, and no separate gate round trip before it.
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.execute).not.toHaveBeenCalled();
    expect(db.query.limit).toHaveBeenCalledTimes(1);
  });

  it('carries the whole visibility contract in that statement WHERE', async () => {
    const db = fakeDb([row]);

    await sharedMealVisibleToActor(ACTOR, SHARE_ID, db as never);

    const where = compile(db.captured.where);
    // The friendship half of the gate, verbatim from share-visibility.
    expect(where.sql).toContain('EXISTS');
    expect(where.sql).toContain('"friendships"."status"');
    // The hole this composition closes: a shared group only admits when it is
    // a NAMED group, so the direct-chat member rows that removeFriend /
    // blockFriend leave behind grant nothing.
    expect(where.sql).toContain('"chat_groups"."kind"');
    expect(where.sql).toContain("'group'");
    // And the page stays in step with the feeds, which render no private share.
    expect(where.sql).toContain("<> 'private'");
    // Scoped to this share, asked on behalf of this actor.
    expect(where.params).toContain(SHARE_ID);
    expect(where.params).toContain(ACTOR);
  });

  it('qualifies every column it names — no bare "group_id"', async () => {
    // The `isSingleTable` hazard share-visibility.ts documents: Drizzle drops
    // the table prefix off SELECT-list columns in a join-free query, which
    // turned the membership self-join into `ON "group_id" = "group_id"`. A
    // WHERE predicate is rendered verbatim, and this query has two joins
    // besides — so the self-join stays qualified on both sides.
    const db = fakeDb([row]);

    await sharedMealVisibleToActor(ACTOR, SHARE_ID, db as never);

    const where = compile(db.captured.where);
    expect(where.sql).toContain(
      '"share_owner_membership"."group_id" = "share_viewer_membership"."group_id"'
    );
  });
});
