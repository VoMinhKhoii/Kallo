import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/infra/db/client', () => ({ db: {} }));

import { sharedGroupMealsBefore } from '@/lib/domain/social/feed/group-meals';

const VIEWER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const GROUP_ID = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const JOINED_AT = new Date('2026-07-01T00:00:00.000Z');

/** select().from().innerJoin()×4.where().orderBy().limit() — captures WHERE. */
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
  // Two people who blocked each other can still share a named group; the
  // group feed must not show either one the other's meals.
  it('excludes meals by anyone in a blocked relation with the viewer', async () => {
    const { db, captured } = fakeDb([]);

    await sharedGroupMealsBefore(
      GROUP_ID,
      VIEWER_ID,
      JOINED_AT,
      null,
      db as never
    );

    const { sql, params } = new PgDialect().sqlToQuery(captured.where as SQL);
    expect(sql).toMatch(/not\s+EXISTS/i);
    expect(sql).toContain(`"friendships"."status" = 'blocked'`);
    expect(sql).toContain('"meal_shares"."actor_id"');
    expect(params).toContain(VIEWER_ID);
  });
});
