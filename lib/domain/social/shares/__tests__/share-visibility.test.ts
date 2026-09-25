import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/infra/db/client', () => ({ db: {} }));

import {
  canViewShare,
  canViewShareOwnedBy,
  friendSinceSql,
  groupShareVisibleSql,
  shareAccessSql,
  shareVisibleIgnoringBlocksSql,
} from '@/lib/domain/social/shares/share-visibility';
import { mealShares } from '@/lib/infra/db/schema';

const VIEWER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OWNER_ID = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const SHARE_ID = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';

/** Both gates render through `db.execute`, so one double serves both. */
function fakeDb(rows: unknown[]) {
  const select = vi.fn();
  const captured: { statement?: SQL } = {};
  const execute = vi.fn((statement: SQL) => {
    captured.statement = statement;
    return Promise.resolve(rows);
  });
  return { select, execute, captured };
}

/** Any of these column names appearing without a table/alias prefix is the
 *  ambiguity that produced PostgresError 42702. */
function expectEveryColumnQualified(statement: SQL | undefined) {
  const { sql } = new PgDialect().sqlToQuery(statement as SQL);
  expect(sql).toContain(
    '"share_owner_membership"."group_id" = "chat_groups"."id"'
  );
  expect(sql).toContain(
    '"share_viewer_membership"."group_id" = "chat_groups"."id"'
  );
  expect(sql).toContain(
    '"chat_groups"."id" = "share_group_membership"."group_id"'
  );
  expect(sql).toContain('"friendships"."user_low"');
  expect(sql).toContain('"user_blocks"."blocker_id"');
  expect(
    sql.match(/(?<![."\w])"(?:group_id|user_id|joined_at|kind|status)"/g)
  ).toBeNull();
  expect(sql.match(/(?<![."\w])"(?:blocker_id|blocked_id)"/g)).toBeNull();
  return sql;
}

describe('canViewShare', () => {
  it('returns the one-statement authorization result', async () => {
    const db = fakeDb([{ visible: true }]);

    await expect(canViewShare(VIEWER_ID, SHARE_ID, db as never)).resolves.toBe(
      true
    );
    expect(db.execute).toHaveBeenCalledTimes(1);
    // Never the query-builder path — that is the shape that produced 42702.
    expect(db.select).not.toHaveBeenCalled();
  });

  it('masks a missing or unauthorized share as false', async () => {
    const missingDb = fakeDb([]);
    const hiddenDb = fakeDb([{ visible: false }]);

    await expect(
      canViewShare(VIEWER_ID, SHARE_ID, missingDb as never)
    ).resolves.toBe(false);
    await expect(
      canViewShare(VIEWER_ID, SHARE_ID, hiddenDb as never)
    ).resolves.toBe(false);
  });

  // Same 42702 regression as the sibling gate below. This one never hit it —
  // its columns sat one SQL nesting level deeper, inside `shareAccessSql` —
  // but both gates now render through the same `readVisible`, so both are
  // pinned rather than one being safe by accident.
  it('qualifies every column reference in the generated SQL', async () => {
    const db = fakeDb([{ visible: true }]);

    await canViewShare(VIEWER_ID, SHARE_ID, db as never);

    const sql = expectEveryColumnQualified(db.captured.statement);
    // It still reads the share row itself — that is what distinguishes it from
    // the already-loaded-row variant.
    expect(sql).toContain('"meal_shares"');
    expect(
      new PgDialect().sqlToQuery(db.captured.statement as SQL).params
    ).toContain(SHARE_ID);
  });
});

describe('canViewShareOwnedBy', () => {
  const sharedAt = new Date('2026-07-10T12:00:00.000Z');

  it('allows the owner without another query', async () => {
    const db = fakeDb([]);

    await expect(
      canViewShareOwnedBy(
        VIEWER_ID,
        { actorId: VIEWER_ID, sharedAt, visibility: 'private' },
        db as never
      )
    ).resolves.toBe(true);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('rejects another owner private share without another query', async () => {
    const db = fakeDb([]);

    await expect(
      canViewShareOwnedBy(
        VIEWER_ID,
        { actorId: OWNER_ID, sharedAt, visibility: 'private' },
        db as never
      )
    ).resolves.toBe(false);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('checks live friendship or named-group access in one query', async () => {
    const db = fakeDb([{ visible: true }]);

    await expect(
      canViewShareOwnedBy(
        VIEWER_ID,
        { actorId: OWNER_ID, sharedAt, visibility: 'circle' },
        db as never
      )
    ).resolves.toBe(true);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it('masks a denied relationship as false', async () => {
    const db = fakeDb([{ visible: false }]);

    await expect(
      canViewShareOwnedBy(
        VIEWER_ID,
        { actorId: OWNER_ID, sharedAt, visibility: 'circle' },
        db as never
      )
    ).resolves.toBe(false);
  });

  // Regression (PostgresError 42702): built as a `db.select({...})` field with
  // no join, Drizzle stripped the table prefix off every column in the
  // membership self-join and emitted `ON "group_id" = "group_id"`, 500ing
  // every cross-user reaction and reply. Render the statement and prove no
  // column reference is left bare.
  it('qualifies every column reference in the generated SQL', async () => {
    const db = fakeDb([{ visible: true }]);

    await canViewShareOwnedBy(
      VIEWER_ID,
      { actorId: OWNER_ID, sharedAt, visibility: 'circle' },
      db as never
    );

    expectEveryColumnQualified(db.captured.statement);
    const { params } = new PgDialect().sqlToQuery(db.captured.statement as SQL);
    // The same bound values as before — the access contract is unchanged.
    // `sharedAt` arrives as encoder-mapped text: a raw Date in a raw fragment
    // reaches the driver unserialized and throws.
    // Order: the block check (either direction), the friendship (bounded by
    // accepted_at), then the group branch — the viewer's memberships, and
    // both people's join times against the share.
    expect(params).toEqual([
      VIEWER_ID,
      OWNER_ID,
      OWNER_ID,
      VIEWER_ID,
      VIEWER_ID,
      OWNER_ID,
      VIEWER_ID,
      OWNER_ID,
      sharedAt.toISOString(),
      VIEWER_ID,
      VIEWER_ID,
      sharedAt.toISOString(),
      OWNER_ID,
      sharedAt.toISOString(),
    ]);
  });

  // A block must close every branch — including a named group both people
  // are still in — so it is applied ONCE, ahead of the whole relationship.
  it('applies the block check once, ahead of every branch', async () => {
    const db = fakeDb([{ visible: false }]);

    await canViewShareOwnedBy(
      VIEWER_ID,
      { actorId: OWNER_ID, sharedAt, visibility: 'circle' },
      db as never
    );

    const { sql } = new PgDialect().sqlToQuery(db.captured.statement as SQL);
    const flat = sql.replace(/\s+/g, ' ');
    expect(flat).toMatch(/^SELECT \(NOT EXISTS \( SELECT 1 FROM "user_blocks"/);
    expect(flat.match(/FROM "user_blocks"/g)).toHaveLength(1);
    expect(flat.indexOf('"user_blocks"')).toBeLessThan(
      flat.indexOf('"friendships"')
    );
  });

  // KALLO-03: a friend who connected after the share was made must not see it.
  it('bounds the friendship branch by accepted_at <= the share time', async () => {
    const db = fakeDb([{ visible: true }]);

    await canViewShareOwnedBy(
      VIEWER_ID,
      { actorId: OWNER_ID, sharedAt, visibility: 'circle' },
      db as never
    );

    const { sql } = new PgDialect().sqlToQuery(db.captured.statement as SQL);
    expect(sql).toContain('"friendships"."accepted_at" <= $9');
  });
});

describe('friend-since bound on share-id reads', () => {
  it('canViewShare compares accepted_at against the share row itself', async () => {
    const db = fakeDb([{ visible: false }]);

    await canViewShare(VIEWER_ID, SHARE_ID, db as never);

    const { sql } = new PgDialect().sqlToQuery(db.captured.statement as SQL);
    expect(sql).toContain(
      '"friendships"."accepted_at" <= "meal_shares"."shared_at"'
    );
  });

  it('shareAccessSql (the share-lookup and copy predicate) carries the bound', () => {
    const { sql } = new PgDialect().sqlToQuery(
      shareAccessSql(
        VIEWER_ID,
        mealShares.actorId,
        mealShares.sharedAt,
        mealShares.visibility
      )
    );
    // Blocks first (for everyone but the owner, who is never self-blocked),
    // then the owner short-circuit and the time-bounded friendship.
    const flat = sql.replace(/\s+/g, ' ');
    expect(flat).toMatch(/^\( NOT EXISTS \( SELECT 1 FROM "user_blocks"/);
    expect(flat).toMatch(/AND \( "meal_shares"\."actor_id" = \$3/);
    expect(sql).toContain(
      '"friendships"."accepted_at" <= "meal_shares"."shared_at"'
    );
  });

  // Report admission judges a share the reporter may have since blocked, so
  // it uses the rule WITHOUT blocks — but otherwise identical: a private
  // share of a stranger stays inadmissible however the block is set.
  it('shareVisibleIgnoringBlocksSql is the same rule minus the block check', () => {
    const { sql } = new PgDialect().sqlToQuery(
      shareVisibleIgnoringBlocksSql(
        VIEWER_ID,
        mealShares.actorId,
        mealShares.sharedAt,
        mealShares.visibility
      )
    );
    expect(sql).not.toContain('user_blocks');
    const flat = sql.replace(/\s+/g, ' ');
    expect(flat).toMatch(
      /^\( "meal_shares"\."actor_id" = \$1 OR \( "meal_shares"\."visibility" <> 'private'/
    );
  });

  it('friendSinceSql requires an accepted edge in either direction', () => {
    const { sql, params } = new PgDialect().sqlToQuery(
      friendSinceSql(VIEWER_ID, mealShares.actorId, mealShares.sharedAt)
    );
    expect(sql).toContain(`"friendships"."status" = 'accepted'`);
    expect(sql).toContain('"friendships"."user_low" = $1');
    expect(sql).toContain('"friendships"."user_high" = $2');
    expect(sql).toContain(
      '"friendships"."accepted_at" <= "meal_shares"."shared_at"'
    );
    expect(params).toEqual([VIEWER_ID, VIEWER_ID]);
  });
});

describe('groupShareVisibleSql', () => {
  // The one group-share rule every group read folds in (feed, chat-list
  // unread and activity): not private, not blocked, both members before.
  it('is not-private AND not-blocked AND both memberships since the share', () => {
    const GROUP_ID = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';
    const { sql, params } = new PgDialect().sqlToQuery(
      groupShareVisibleSql(VIEWER_ID, GROUP_ID, mealShares)
    );
    const flat = sql.replace(/\s+/g, ' ');
    expect(flat).toContain(`"meal_shares"."visibility" <> 'private'`);
    expect(flat).toContain('NOT EXISTS ( SELECT 1 FROM "user_blocks"');
    expect(flat).toContain(
      '"share_viewer_membership"."joined_at" <= "meal_shares"."shared_at"'
    );
    expect(flat).toContain(
      '"share_owner_membership"."joined_at" <= "meal_shares"."shared_at"'
    );
    expect(flat).not.toContain('"chat_groups"."kind"');
    expect(params).toContain(GROUP_ID);
  });
});
