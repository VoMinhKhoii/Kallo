import { vi } from 'vitest';
import type { AppDb } from '@/lib/db';

/**
 * Minimal stand-in for the Drizzle query builder.
 *
 * The waitlist modules take their `db` as an injected dep, so the tests need a
 * chainable object rather than a module mock: every builder method returns the
 * same thenable, which resolves to the next queued result.
 */

export interface FakeDb {
  db: AppDb;
  /** Queue the rows the next `select(...)` chain should resolve to. */
  queueSelect: (rows: unknown[]) => void;
  /** Rows passed to `insert(...).values(...)`, in order. */
  inserts: Record<string, unknown>[];
  /** Patches passed to `update(...).set(...)`, in order. */
  updates: Record<string, unknown>[];
  /** How many times a transaction was opened. */
  transactions: () => number;
}

/**
 * A real Promise carrying the builder methods, so `await`ing it anywhere in the
 * chain yields `result`. Built on an actual Promise rather than an object with
 * a hand-written `then` — a bare thenable is exactly the footgun
 * `lint/suspicious/noThenProperty` exists to catch.
 */
function chain(
  result: unknown,
  capture?: (values: Record<string, unknown>) => void
) {
  const self = Promise.resolve(result) as Promise<unknown> &
    Record<string, unknown>;

  for (const method of ['from', 'where', 'limit', 'returning']) {
    self[method] = () => self;
  }
  for (const method of ['set', 'values']) {
    self[method] = (values: Record<string, unknown>) => {
      capture?.(values);
      return self;
    };
  }
  return self;
}

export function createFakeDb(): FakeDb {
  const selectQueue: unknown[][] = [];
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  let transactionCount = 0;

  const handle = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(() => chain(selectQueue.shift() ?? [])),
    insert: vi.fn(() => chain([], (values) => inserts.push(values))),
    update: vi.fn(() =>
      chain([{ id: 'row-1' }], (values) => updates.push(values))
    ),
  };

  const db = {
    ...handle,
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      transactionCount += 1;
      return fn(handle);
    }),
  } as unknown as AppDb;

  return {
    db,
    queueSelect: (rows) => selectQueue.push(rows),
    inserts,
    updates,
    transactions: () => transactionCount,
  };
}
