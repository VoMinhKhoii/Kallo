import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
  markRead,
  markSeen,
  readBadgeState,
} from '@/lib/actions/notifications/state';

const USER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OTHER = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const ID_A = 'd3bbef22-cf3e-4bb1-9e90-9eecef613d44';
const ID_B = 'e4ccff33-d04f-4cc2-af01-affdf0724e55';

/** Bound values out of a Drizzle SQL tree (Param = {value, encoder}); the tree
 *  also holds self-referential table objects, so it cannot be stringified. */
function paramValues(node: unknown, out: unknown[] = []): unknown[] {
  if (Array.isArray(node)) {
    for (const child of node) paramValues(child, out);
    return out;
  }
  if (!node || typeof node !== 'object') return out;
  const record = node as Record<string, unknown>;
  if ('value' in record && 'encoder' in record) out.push(record.value);
  if ('queryChunks' in record) paramValues(record.queryChunks, out);
  return out;
}

function countingDb(rows: unknown[]) {
  const captured: { where?: unknown } = {};
  const select = vi.fn(() => ({
    from: () => ({
      where: (where: unknown) => {
        captured.where = where;
        return Promise.resolve(rows);
      },
    }),
  }));
  return { db: { select } as never, captured };
}

function updatingDb(returned: unknown[]) {
  const captured: { set?: Record<string, unknown>; where?: unknown } = {};
  const update = vi.fn(() => ({
    set: (values: Record<string, unknown>) => {
      captured.set = values;
      return {
        where: (where: unknown) => {
          captured.where = where;
          return { returning: () => Promise.resolve(returned) };
        },
      };
    },
  }));
  return { db: { update } as never, captured, update };
}

describe('readBadgeState', () => {
  const WATERMARK = new Date('2026-08-28T10:00:00.000Z');

  it('counts only the recipient’s own rows', async () => {
    const { db, captured } = countingDb([
      { unseen: 3, latestActivityAt: WATERMARK },
    ]);

    await expect(readBadgeState(USER, db)).resolves.toEqual({
      unseen: 3,
      latestActivityAt: WATERMARK.toISOString(),
    });
    const values = paramValues(captured.where);
    expect(values).toContain(USER);
    expect(values).not.toContain(OTHER);
  });

  // The watermark is what heals a cursor jump, so it must move for ANY
  // activity — including a silent refresh that leaves the count alone.
  it('reports the watermark even when nothing is unseen', async () => {
    const { db } = countingDb([{ unseen: 0, latestActivityAt: WATERMARK }]);

    await expect(readBadgeState(USER, db)).resolves.toEqual({
      unseen: 0,
      latestActivityAt: WATERMARK.toISOString(),
    });
  });

  it('reports zero and no watermark when the recipient has no rows', async () => {
    const { db } = countingDb([{ unseen: 0, latestActivityAt: null }]);

    await expect(readBadgeState(USER, db)).resolves.toEqual({
      unseen: 0,
      latestActivityAt: null,
    });
  });
});

describe('markSeen', () => {
  it('bounds the bulk clear by recipient and by the snapshot instant', async () => {
    const { db, captured } = updatingDb([{ id: ID_A }]);
    const before = '2026-08-01T10:00:00.000Z';

    await expect(markSeen(USER, before, db)).resolves.toEqual({ seen: 1 });

    const values = paramValues(captured.where);
    expect(values).toContain(USER);
    expect(values).toContainEqual(new Date(before));
    expect(captured.set).toHaveProperty('seenAt');
    // Never touches read_at — seen and read are independent states.
    expect(captured.set).not.toHaveProperty('readAt');
  });

  // Regression: every other case here uses a millisecond-precision instant, so
  // none of them could see the defect. Postgres stores `created_at` in
  // MICROseconds; the watermark the client posts is the feed's
  // `toISOString()`, which truncates to milliseconds. A raw
  // `created_at <= $1` therefore misses the newest row by its sub-millisecond
  // remainder (observed live: watermark …34.246Z cleared 0 rows, …34.247Z
  // cleared 1) and the badge never clears.
  it('clears the newest row even when Postgres kept microseconds', async () => {
    const { db, captured } = updatingDb([{ id: ID_A }]);
    const stored = '2026-08-28T09:24:34.246789Z';
    const watermark = new Date(stored).toISOString();

    // The best watermark the Activity page can send has already lost the µs
    // remainder, so it sits strictly below the stored instant — the defect.
    expect(watermark).toBe('2026-08-28T09:24:34.246Z');

    await expect(markSeen(USER, watermark, db)).resolves.toEqual({ seen: 1 });

    const { sql, params } = new PgDialect().sqlToQuery(captured.where as SQL);
    // Truncating the column to milliseconds compares like against like:
    // date_trunc('milliseconds', …246789Z) = …246Z, which satisfies `<=`.
    expect(sql).toContain(
      `date_trunc('milliseconds', "notifications"."created_at") <=`
    );
    // Bound through the column's encoder, so the driver sees the ms watermark
    // as text — never a raw Date, which this driver cannot serialize.
    expect(params).toContain(watermark);
    expect(truncateToMilliseconds(stored)).toBe(watermark);
    // Still recipient-scoped and still only unseen rows.
    expect(sql).toContain('"recipient_id"');
    expect(sql).toContain('"seen_at" is null');
  });
});

/** What `date_trunc('milliseconds', …)` does to a stored µs timestamp. JS
 *  `Date` cannot hold microseconds, so the fixture is compared as text. */
function truncateToMilliseconds(microIso: string): string {
  return microIso.replace(/(\.\d{3})\d+/, '$1');
}

describe('markRead', () => {
  it('scopes the id list to the recipient', async () => {
    const { db, captured } = updatingDb([{ id: ID_A }]);

    await expect(markRead(USER, [ID_A, ID_B], db)).resolves.toEqual({
      read: 1,
    });

    const values = paramValues(captured.where);
    expect(values).toContain(USER);
    expect(values).toContain(ID_A);
    expect(values).not.toContain(OTHER);
  });

  it('also marks the row seen so the badge cannot stick', async () => {
    const { db, captured } = updatingDb([{ id: ID_A }]);

    await markRead(USER, [ID_A], db);

    expect(captured.set).toHaveProperty('readAt');
    expect(captured.set).toHaveProperty('seenAt');
  });

  it('never issues a statement for an empty id list', async () => {
    const { db, update } = updatingDb([]);

    await expect(markRead(USER, [], db)).resolves.toEqual({ read: 0 });
    expect(update).not.toHaveBeenCalled();
  });
});
