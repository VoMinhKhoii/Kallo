import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
  blockedBetweenSql,
  isBlockedPair,
  lockPairSql,
  notBlockedWithSql,
} from '@/lib/domain/social/moderation/blocks';
import { mealShareReplies, userBlocks } from '@/lib/infra/db/schema';

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

describe('isBlockedPair', () => {
  // The same either-direction condition the EXISTS form wraps, counted over
  // user_blocks — one spelling of the rule, read as a boolean.
  it('counts user_blocks rows matching the pair in either direction', async () => {
    const $count = vi.fn(async (..._args: unknown[]) => 1);

    await expect(
      isBlockedPair({ $count } as never, VIEWER, OTHER)
    ).resolves.toBe(true);

    const [table, condition] = $count.mock.calls[0] ?? [];
    expect(table).toBe(userBlocks);
    const { sql, params } = new PgDialect().sqlToQuery(condition as never);
    expect(flat(sql)).toBe(
      '(("user_blocks"."blocker_id" = $1 AND "user_blocks"."blocked_id" = $2) OR ("user_blocks"."blocker_id" = $3 AND "user_blocks"."blocked_id" = $4))'
    );
    expect(params).toEqual([VIEWER, OTHER, OTHER, VIEWER]);
  });

  it('is false when no row matches', async () => {
    const $count = vi.fn(async () => 0);
    await expect(
      isBlockedPair({ $count } as never, VIEWER, OTHER)
    ).resolves.toBe(false);
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
