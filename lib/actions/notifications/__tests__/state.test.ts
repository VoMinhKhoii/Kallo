import { describe, expect, it, vi } from 'vitest';
import {
  countUnseen,
  markRead,
  markSeen,
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

describe('countUnseen', () => {
  it('counts only the recipient’s own rows', async () => {
    const { db, captured } = countingDb([{ count: 3 }]);

    await expect(countUnseen(USER, db)).resolves.toBe(3);
    const values = paramValues(captured.where);
    expect(values).toContain(USER);
    expect(values).not.toContain(OTHER);
  });

  it('reports zero when nothing is pending', async () => {
    const { db } = countingDb([]);
    await expect(countUnseen(USER, db)).resolves.toBe(0);
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
});

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
