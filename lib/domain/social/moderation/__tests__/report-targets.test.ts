import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/infra/db/client', () => ({ db: {} }));

import { resolveReportTarget } from '@/lib/domain/social/moderation/report-targets';
import { shareVisibleIgnoringBlocksSql } from '@/lib/domain/social/shares/share-visibility';
import { mealShares } from '@/lib/infra/db/schema';

const REPORTER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OWNER = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const TARGET = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const GROUP = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';

// Whitespace and parameter numbers vary with where a fragment is embedded.
const flat = (sql: string) => sql.replace(/\s+/g, ' ').replace(/\$\d+/g, '$?');

/** Each select() resolves (at .limit()) to the next queued row set, and
 * records the WHERE it was given — admission is a predicate on the read. */
function fakeDb(...results: unknown[][]) {
  const queue = [...results];
  const wheres: SQL[] = [];
  const select = vi.fn(() => {
    const rows = queue.shift() ?? [];
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.where = vi.fn((condition: SQL) => {
      wheres.push(condition);
      return chain;
    });
    chain.limit = vi.fn().mockResolvedValue(rows);
    return chain;
  });
  return { db: { select } as never, wheres };
}

/** The pure (block-ignoring) share rule, rendered for comparison. */
const PURE_RULE = flat(
  new PgDialect().sqlToQuery(
    shareVisibleIgnoringBlocksSql(
      REPORTER,
      mealShares.actorId,
      mealShares.sharedAt,
      mealShares.visibility
    )
  ).sql
);

describe('resolveReportTarget', () => {
  it('share: admission is the share rule ignoring blocks, in the read WHERE', async () => {
    const { db, wheres } = fakeDb([{ actorId: OWNER, rawInput: 'phở bò tái' }]);

    await expect(
      resolveReportTarget(REPORTER, 'share', TARGET, db)
    ).resolves.toEqual({ ownerId: OWNER, excerpt: 'phở bò tái' });

    const where = flat(new PgDialect().sqlToQuery(wheres[0]).sql);
    expect(where).toContain(PURE_RULE);
    // It checks visibility — a private share of anyone but the reporter is
    // out — and contains no block bypass of any kind.
    expect(where).toContain(`"meal_shares"."visibility" <> 'private'`);
    expect(where).not.toContain('user_blocks');
  });

  // The leak this closes: block a stranger, then report their PRIVATE share.
  // The old admission let any share by a blocked person through, confirming
  // the share existed (201 instead of 404) and mailing its text to admins.
  // Now the database refuses the row (private, no relationship), so the read
  // returns nothing and the target resolves to null → 404.
  it('share: a blocked stranger’s private share resolves to null (404)', async () => {
    const { db, wheres } = fakeDb([]);

    await expect(
      resolveReportTarget(REPORTER, 'share', TARGET, db)
    ).resolves.toBeNull();
    // Only the one admission-carrying read: nothing consults blocks after it.
    expect(wheres).toHaveLength(1);
  });

  it('reply: resolves to the reply author, admitted by the same rule', async () => {
    const AUTHOR = 'e4ccff33-d04f-4cc2-af01-affdf0724e55';
    const { db, wheres } = fakeDb([{ authorId: AUTHOR, body: 'rude words' }]);

    await expect(
      resolveReportTarget(REPORTER, 'reply', TARGET, db)
    ).resolves.toEqual({ ownerId: AUTHOR, excerpt: 'rude words' });
    expect(flat(new PgDialect().sqlToQuery(wheres[0]).sql)).toContain(
      PURE_RULE
    );
  });

  it('chat_message: only a member of the chat may report it', async () => {
    const message = { senderId: OWNER, groupId: GROUP, body: 'x'.repeat(400) };

    const member = await resolveReportTarget(
      REPORTER,
      'chat_message',
      TARGET,
      fakeDb([message], [{ groupId: GROUP }]).db
    );
    expect(member?.ownerId).toBe(OWNER);
    expect(member?.excerpt).toHaveLength(280);

    await expect(
      resolveReportTarget(
        REPORTER,
        'chat_message',
        TARGET,
        fakeDb([message], []).db
      )
    ).resolves.toBeNull();
  });

  it('chat_group: resolves to the creator for a member', async () => {
    const { db } = fakeDb(
      [{ createdBy: OWNER, name: 'Team phở' }],
      [{ groupId: GROUP }]
    );

    await expect(
      resolveReportTarget(REPORTER, 'chat_group', GROUP, db)
    ).resolves.toEqual({ ownerId: OWNER, excerpt: 'Team phở' });
  });

  it('profile: any existing circle profile, by user id', async () => {
    await expect(
      resolveReportTarget(
        REPORTER,
        'profile',
        OWNER,
        fakeDb([{ userId: OWNER, handle: 'phofan', displayName: 'Phở Fan' }]).db
      )
    ).resolves.toEqual({ ownerId: OWNER, excerpt: 'Phở Fan (@phofan)' });
    await expect(
      resolveReportTarget(REPORTER, 'profile', OWNER, fakeDb([]).db)
    ).resolves.toBeNull();
  });
});
