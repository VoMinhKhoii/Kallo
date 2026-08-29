import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/infra/db/client', () => ({ db: {} }));

import {
  canViewShare,
  canViewShareOwnedBy,
} from '@/lib/domain/social/shares/share-visibility';

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
    '"share_owner_membership"."group_id" = "share_viewer_membership"."group_id"'
  );
  expect(sql).toContain(
    '"chat_groups"."id" = "share_viewer_membership"."group_id"'
  );
  expect(sql).toContain('"friendships"."user_low"');
  expect(
    sql.match(/(?<![."\w])"(?:group_id|user_id|joined_at|kind|status)"/g)
  ).toBeNull();
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
    expect(params).toEqual([
      VIEWER_ID,
      OWNER_ID,
      VIEWER_ID,
      OWNER_ID,
      VIEWER_ID,
      OWNER_ID,
      sharedAt.toISOString(),
      sharedAt.toISOString(),
    ]);
  });
});
