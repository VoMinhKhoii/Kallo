import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  blockedBetweenSql,
  lockPairSql,
  notBlockedWithSql,
} from '@/lib/domain/social/moderation/blocks';
import { mealShareReplies } from '@/lib/infra/db/schema';

const VIEWER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OTHER = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';

const flat = (sql: string) => sql.replace(/\s+/g, ' ');

describe('blockedBetweenSql', () => {
  // Blocks are stored directed (blocker → blocked) but hide both people, so
  // the rule must match a row in EITHER direction.
  it('matches a user_blocks row in either direction, fully qualified', () => {
    const { sql, params } = new PgDialect().sqlToQuery(
      blockedBetweenSql(VIEWER, mealShareReplies.userId)
    );
    expect(flat(sql)).toContain(
      '("user_blocks"."blocker_id" = $1 AND "user_blocks"."blocked_id" = "meal_share_replies"."user_id")'
    );
    expect(flat(sql)).toContain(
      'OR ("user_blocks"."blocker_id" = "meal_share_replies"."user_id" AND "user_blocks"."blocked_id" = $2)'
    );
    // No bare column the embedding statement could find ambiguous (42702),
    // and nothing left of the retired friendships-status form.
    expect(sql.match(/(?<![."\w])"(?:blocker_id|blocked_id)"/g)).toBeNull();
    expect(sql).not.toContain('friendships');
    expect(params).toEqual([VIEWER, VIEWER]);
  });

  it('binds two literal ids as parameters', () => {
    const { params } = new PgDialect().sqlToQuery(
      blockedBetweenSql(VIEWER, OTHER)
    );
    expect(params).toEqual([VIEWER, OTHER, OTHER, VIEWER]);
  });

  it('notBlockedWithSql is its negation', () => {
    const { sql } = new PgDialect().sqlToQuery(
      notBlockedWithSql(VIEWER, OTHER)
    );
    expect(sql).toMatch(/^NOT\s+EXISTS/);
  });
});

describe('lockPairSql', () => {
  it('takes one transaction-scoped advisory lock keyed on the ordered pair', () => {
    const { sql, params } = new PgDialect().sqlToQuery(
      lockPairSql(VIEWER, OTHER)
    );
    expect(sql).toContain('pg_advisory_xact_lock(hashtextextended($1, 0))');
    expect(params).toEqual([`friend-pair:${VIEWER}:${OTHER}`]);
  });
});
