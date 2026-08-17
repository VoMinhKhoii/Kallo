import { type Mock, vi } from 'vitest';
import type { AppDb } from '@/lib/infra/db/client';

/**
 * The shared stand-in for the Drizzle query builder.
 *
 * Modules that take their `db` as an injected dep need a chainable object
 * rather than a module mock: every builder method returns the same thenable,
 * which resolves to the next queued result. Every suite that wanted that was
 * hand-rolling its own double-cast `AppDb` object, so the cast — and the chance
 * of two doubles disagreeing about what `update().returning()` yields — lives
 * here once instead of once per suite.
 *
 * Its contract is pinned by `lib/db/__tests__/fake-db.test.ts`.
 *
 * Deliberately NOT a database simulator: it has no tables, no filtering and no
 * SQL parsing. A suite that needs the query itself to decide the answer wants a
 * purpose-built double instead (see `lib/ai/__fixtures__/test-helpers.ts`,
 * which routes on SQL text, and the in-memory guard state in
 * `lib/rate-limit/__tests__/analysis-guards.test.ts`).
 */

export interface FakeDb {
  db: AppDb;
  /** Queue the rows the next `select(...)` chain should resolve to. */
  queueSelect: (rows: unknown[]) => void;
  /**
   * Queue the rows the next `update(...).returning()` resolves to. Defaults to
   * a single row when nothing is queued, so an update reads as "one row
   * changed" unless a test explicitly models a zero-row update (e.g. a lost
   * race on a single-use token).
   */
  queueUpdate: (rows: unknown[]) => void;
  /** Queue the rows the next raw `execute(...)` resolves to. Defaults to none. */
  queueExecute: (rows: unknown[]) => void;
  /** The `execute` spy itself, for call-count and argument assertions. */
  execute: Mock;
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
  const updateQueue: unknown[][] = [];
  const executeQueue: unknown[][] = [];
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  let transactionCount = 0;

  const execute = vi.fn(async () => executeQueue.shift() ?? []);

  const handle = {
    execute,
    select: vi.fn(() => chain(selectQueue.shift() ?? [])),
    insert: vi.fn(() => chain([], (values) => inserts.push(values))),
    update: vi.fn(() =>
      chain(updateQueue.shift() ?? [{ id: 'row-1' }], (values) =>
        updates.push(values)
      )
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
    queueUpdate: (rows) => updateQueue.push(rows),
    queueExecute: (rows) => executeQueue.push(rows),
    execute,
    inserts,
    updates,
    transactions: () => transactionCount,
  };
}
