// closeAggregates is one UPDATE, and its whole correctness is in the predicate:
// the right recipients (never a cross-tenant write — the Drizzle handle
// bypasses RLS), the group key the CALLER chose, and only rows that are still
// OPEN, so a second close is a no-op instead of restamping history. There is no
// database here, so the statement is rendered to SQL + params and asserted
// directly.

import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import { shareInviteKey } from '@/lib/domain/notifications/group-keys';
import { closeAggregates } from '@/lib/domain/notifications/notify';

const RECIPIENT = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OTHER_RECIPIENT = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const SOURCE_MEAL = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';

/** A tx double capturing the one UPDATE's SET values and WHERE clause. */
function updatingTx() {
  const captured: { set?: Record<string, unknown>; where?: SQL } = {};
  const update = vi.fn(() => ({
    set: (values: Record<string, unknown>) => {
      captured.set = values;
      return {
        where: (condition: SQL) => {
          captured.where = condition;
          return Promise.resolve(undefined);
        },
      };
    },
  }));
  return { tx: { update } as never, update, captured };
}

function renderWhere(where: SQL | undefined) {
  return new PgDialect().sqlToQuery(where as SQL);
}

describe('closeAggregates', () => {
  it('scopes the close to the given recipients and group key', async () => {
    const { tx, captured } = updatingTx();

    await closeAggregates(tx, {
      recipientIds: [RECIPIENT],
      groupKey: shareInviteKey(SOURCE_MEAL),
    });

    const { sql, params } = renderWhere(captured.where);
    expect(sql).toContain('"recipient_id"');
    expect(sql).toContain('"group_key"');
    // The caller owns the key: `share.invite` aggregates on the SOURCE meal,
    // and an invite-id key would never match the row the producer opened.
    expect(params).toEqual([RECIPIENT, `share.invite:${SOURCE_MEAL}`]);
  });

  it('closes every listed recipient in one statement', async () => {
    const { tx, update, captured } = updatingTx();

    await closeAggregates(tx, {
      recipientIds: [RECIPIENT, OTHER_RECIPIENT],
      groupKey: shareInviteKey(SOURCE_MEAL),
    });

    // The split auto-dismiss closes a whole set of third parties at once —
    // one `in` predicate, not a statement per person.
    expect(update).toHaveBeenCalledTimes(1);
    expect(renderWhere(captured.where).params).toEqual([
      RECIPIENT,
      OTHER_RECIPIENT,
      `share.invite:${SOURCE_MEAL}`,
    ]);
  });

  it('issues no statement at all for an empty recipient list', async () => {
    const { tx, update } = updatingTx();

    await closeAggregates(tx, {
      recipientIds: [],
      groupKey: shareInviteKey(SOURCE_MEAL),
    });

    expect(update).not.toHaveBeenCalled();
  });

  it('touches only rows that are still open', async () => {
    const { tx, captured } = updatingTx();

    await closeAggregates(tx, {
      recipientIds: [RECIPIENT],
      groupKey: shareInviteKey(SOURCE_MEAL),
    });

    const { sql } = renderWhere(captured.where);
    // `read_at is null` is what makes a second close (the Activity card's own
    // markRead, a retry, an accept racing an auto-dismiss) a no-op rather than
    // a rewrite of history; dismissed rows are already out of the open set.
    expect(sql).toContain('"read_at" is null');
    expect(sql).toContain('"dismissed_at" is null');
  });

  it('reads the row, preserving an existing sighting time', async () => {
    const { tx, captured } = updatingTx();

    await closeAggregates(tx, {
      recipientIds: [RECIPIENT],
      groupKey: shareInviteKey(SOURCE_MEAL),
    });

    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(captured.set?.readAt as SQL).sql).toBe('now()');
    // A read row also counts as seen, but the original sighting survives.
    expect(dialect.sqlToQuery(captured.set?.seenAt as SQL).sql).toBe(
      'COALESCE("notifications"."seen_at", now())'
    );
    expect(dialect.sqlToQuery(captured.set?.updatedAt as SQL).sql).toBe(
      'now()'
    );
    // Never dismissed: closing is a read, not a hide — the row stays in the
    // feed as history.
    expect(captured.set).not.toHaveProperty('dismissedAt');
  });
});
