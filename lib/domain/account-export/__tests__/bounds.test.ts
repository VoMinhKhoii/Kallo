import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { createExportDb } from '@/lib/domain/account-export/__fixtures__/export-db';
import { buildDataExport } from '@/lib/domain/account-export/build-export';

const user = { id: '11111111-1111-4111-8111-111111111111' };

describe('account export database bounds', () => {
  it('runs every read sequentially on one read-only snapshot with a local deadline', async () => {
    const { db, concurrency, transaction, execute, queries, select } =
      createExportDb();
    await buildDataExport(db, user);

    expect(concurrency.peak).toBe(1);
    expect(concurrency.active).toBe(0);
    expect(transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), {
      accessMode: 'read only',
      isolationLevel: 'repeatable read',
    });
    expect(db.select).not.toHaveBeenCalled();
    expect(queries.length).toBeGreaterThan(25);
    expect(execute).toHaveBeenCalledOnce();
    expect(new PgDialect().sqlToQuery(execute.mock.calls[0][0]).sql).toBe(
      "SET LOCAL statement_timeout = '15s'"
    );
    expect(execute.mock.invocationCallOrder[0]).toBeLessThan(
      select.mock.invocationCallOrder[0]
    );
  });

  it('does not enqueue further reads or return a partial document after a query fails', async () => {
    const failure = new Error('statement timeout');
    const { db, queries, concurrency } = createExportDb((query) => {
      if (query.from === 'meal_items') throw failure;
      return undefined;
    });

    await expect(buildDataExport(db, user)).rejects.toBe(failure);
    expect(concurrency.active).toBe(0);
    expect(queries.at(-1)?.from).toBe('meal_items');
    expect(queries.some((query) => query.from === 'notifications')).toBe(false);
  });

  it('exports every row of a long history without a truncation limit', async () => {
    const weights = Array.from({ length: 1200 }, (_, index) => ({
      id: `weight-${index}`,
    }));
    const { db } = createExportDb((query) =>
      query.from === 'body_weight_log' ? weights : undefined
    );
    const result = await buildDataExport(db, user);
    expect(result.weights).toEqual(weights);
  });
});
