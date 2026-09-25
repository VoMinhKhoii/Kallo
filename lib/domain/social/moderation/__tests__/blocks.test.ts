import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/infra/db/client', () => ({ db: {} }));

import {
  blockedBetweenSql,
  blockedUserIds,
  notBlockedWithSql,
} from '@/lib/domain/social/moderation/blocks';
import { mealShareReplies } from '@/lib/infra/db/schema';

const VIEWER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OTHER = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const THIRD = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';

describe('blockedBetweenSql', () => {
  it('matches a blocked edge in either direction, fully qualified', () => {
    const { sql, params } = new PgDialect().sqlToQuery(
      blockedBetweenSql(VIEWER, mealShareReplies.userId)
    );
    const flat = sql.replace(/\s+/g, ' ');
    expect(flat).toContain(`"friendships"."status" = 'blocked'`);
    expect(flat).toContain(
      '"friendships"."user_low" = $1 AND "friendships"."user_high" = "meal_share_replies"."user_id"'
    );
    expect(flat).toContain(
      '"friendships"."user_high" = $2 AND "friendships"."user_low" = "meal_share_replies"."user_id"'
    );
    // No bare column the embedding statement could find ambiguous (42702).
    expect(sql.match(/(?<![."\w])"(?:status|user_low|user_high)"/g)).toBeNull();
    expect(params).toEqual([VIEWER, VIEWER]);
  });

  it('binds a literal counterpart id as a parameter', () => {
    const { params } = new PgDialect().sqlToQuery(
      blockedBetweenSql(VIEWER, OTHER)
    );
    expect(params).toEqual([VIEWER, OTHER, VIEWER, OTHER]);
  });

  it('notBlockedWithSql is its negation', () => {
    const { sql } = new PgDialect().sqlToQuery(
      notBlockedWithSql(VIEWER, OTHER)
    );
    expect(sql).toMatch(/^NOT\s+EXISTS/);
  });
});

describe('blockedUserIds', () => {
  it('returns the other side of every blocked edge touching the viewer', async () => {
    const where = vi.fn().mockResolvedValue([
      { userLow: VIEWER, userHigh: OTHER },
      { userLow: THIRD, userHigh: VIEWER },
    ]);
    const db = { select: vi.fn(() => ({ from: vi.fn(() => ({ where })) })) };

    const ids = await blockedUserIds(VIEWER, db as never);

    expect([...ids].sort()).toEqual([OTHER, THIRD].sort());
    const { sql, params } = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(sql).toContain('"friendships"."status" = $1');
    expect(params).toEqual(['blocked', VIEWER, VIEWER]);
  });
});
