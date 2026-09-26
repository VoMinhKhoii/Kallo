import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/infra/db/client', () => ({ db: {} }));

import { sharedGroupMealsBefore } from '@/lib/domain/social/feed/group-meals';
import { groupShareVisibleSql } from '@/lib/domain/social/shares/share-visibility';
import { mealShares } from '@/lib/infra/db/schema';

const VIEWER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const GROUP_ID = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';

const flat = (sql: string) => sql.replace(/\s+/g, ' ');

/** select().from().innerJoin()×3.where().orderBy().limit() — captures WHERE. */
function fakeDb(rows: unknown[]) {
  const captured: { where?: SQL } = {};
  const level = {
    innerJoin: vi.fn(),
    where: vi.fn((condition: SQL) => {
      captured.where = condition;
      return {
        orderBy: vi.fn(() => ({ limit: vi.fn().mockResolvedValue(rows) })),
      };
    }),
  };
  level.innerJoin.mockReturnValue(level);
  const db = { select: vi.fn(() => ({ from: vi.fn(() => level) })) };
  return { db, captured };
}

describe('sharedGroupMealsBefore', () => {
  // The feed admits by THE group-share rule and nothing hand-copied: not
  // private, not blocked (two people who blocked each other can still share a
  // named group), both members joined before the share.
  it('admits rows by groupShareVisibleSql for this viewer and group', async () => {
    const { db, captured } = fakeDb([]);

    await sharedGroupMealsBefore(GROUP_ID, VIEWER_ID, null, db as never);

    const { sql } = new PgDialect().sqlToQuery(captured.where as SQL);
    const rule = new PgDialect().sqlToQuery(
      groupShareVisibleSql(VIEWER_ID, GROUP_ID, mealShares)
    ).sql;
    expect(flat(sql)).toContain(flat(rule));
    expect(flat(sql)).toContain(`"meal_shares"."visibility" <> 'private'`);
    expect(flat(sql)).toContain('NOT EXISTS ( SELECT 1 FROM "user_blocks"');
    expect(flat(sql)).toContain('"share_owner_membership"."joined_at" <=');
  });
});
