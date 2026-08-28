// closeInviteNotification is one UPDATE, and its whole correctness is in the
// predicate: the right recipient (never a cross-tenant write — the Drizzle
// handle bypasses RLS), the right aggregation key (the SOURCE meal, which is
// what share.invite groups on — not the invite id), and only rows that are
// still OPEN, so a second close is a no-op instead of restamping history.
// There is no database here, so the statement is rendered to SQL + params and
// asserted directly.

import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import { closeInviteNotification } from '@/lib/domain/notifications/close-invite-notification';

const RECIPIENT = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
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

describe('closeInviteNotification', () => {
  it('scopes the close to one recipient and their invite aggregate', async () => {
    const { tx, captured } = updatingTx();

    await closeInviteNotification(tx, {
      recipientId: RECIPIENT,
      sourceMealId: SOURCE_MEAL,
    });

    const { sql, params } = renderWhere(captured.where);
    expect(sql).toContain('"recipient_id"');
    expect(sql).toContain('"group_key"');
    // Keyed by the SOURCE meal, matching shareInviteKey — an invite-id key
    // would never match the row the producer opened.
    expect(params).toEqual([RECIPIENT, `share.invite:${SOURCE_MEAL}`]);
  });

  it('touches only rows that are still open', async () => {
    const { tx, captured } = updatingTx();

    await closeInviteNotification(tx, {
      recipientId: RECIPIENT,
      sourceMealId: SOURCE_MEAL,
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

    await closeInviteNotification(tx, {
      recipientId: RECIPIENT,
      sourceMealId: SOURCE_MEAL,
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

  it('issues exactly one statement', async () => {
    const { tx, update } = updatingTx();

    await closeInviteNotification(tx, {
      recipientId: RECIPIENT,
      sourceMealId: SOURCE_MEAL,
    });

    expect(update).toHaveBeenCalledTimes(1);
  });
});
