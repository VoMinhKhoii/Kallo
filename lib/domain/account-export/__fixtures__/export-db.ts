import {
  Column,
  getTableColumns,
  getTableName,
  is,
  type SQL,
  type Table,
} from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { vi } from 'vitest';
import type { AppDb } from '@/lib/infra/db/client';

/**
 * A schema-aware stand-in for the Drizzle query builder, for the export.
 *
 * Every `select(...).from(...)…` chain the builders run is captured — the
 * table, the joins and the WHERE — so a test can compile the predicate and
 * prove it is scoped to the caller. By default each query answers with ONE
 * plausible row generated from the selected Drizzle columns themselves, so a
 * populated export exercises every selected column (and its runtime type)
 * without a hand-written fixture per table. `rows` overrides that per query.
 */

export interface CapturedQuery {
  from: string;
  joins: string[];
  where?: SQL;
  fields?: Record<string, unknown>;
}

export const SAMPLE_UUID = '99999999-9999-4999-8999-999999999999';
const SAMPLE_DATE = new Date('2026-09-01T08:00:00.000Z');

/**
 * A different value of the same runtime shape, for the column-coverage test:
 * it builds the export once with a column perturbed, and the column counts as
 * exported only if the document changes.
 */
function perturbedValue(column: Column): unknown {
  const value = sampleValue(column);
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number') return value + 7;
  if (value instanceof Date) return new Date(value.getTime() + 86_400_000);
  if (Array.isArray(value)) return [PERTURBED_UUID];
  if (column.columnType === 'PgUUID') return PERTURBED_UUID;
  if (column.columnType === 'PgDateString') return '2026-09-02';
  if (column.columnType === 'PgNumeric') return '2.75';
  if (typeof value === 'string') return `${value}~perturbed`;
  return { perturbed: true };
}

const PERTURBED_UUID = '88888888-8888-4888-8888-888888888888';

/** A value of the right runtime shape for one Drizzle column. */
export function sampleValue(column: Column): unknown {
  switch (column.columnType) {
    case 'PgUUID':
      return SAMPLE_UUID;
    case 'PgDateString':
      return '2026-09-01';
    case 'PgNumeric':
      return '1.50';
    case 'PgInteger':
    case 'PgSmallInt':
    case 'PgSerial':
      return 1;
    case 'PgArray':
      return [SAMPLE_UUID];
    default:
      break;
  }
  switch (column.dataType) {
    case 'number':
      return 1.5;
    case 'boolean':
      return true;
    case 'date':
      return SAMPLE_DATE;
    case 'json':
      return { sample: 'value' };
    default:
      return 'sample';
  }
}

function sampleFromFields(
  fields: Record<string, unknown>,
  perturb?: Column
): unknown {
  return Object.fromEntries(
    Object.entries(fields).map(([key, field]) => {
      if (is(field, Column)) {
        return [
          key,
          field === perturb ? perturbedValue(field) : sampleValue(field),
        ];
      }
      if (field && typeof field === 'object' && !('getSQL' in field)) {
        return [
          key,
          sampleFromFields(field as Record<string, unknown>, perturb),
        ];
      }
      // A raw `sql<string>` expression — the export only computes ids.
      return [key, SAMPLE_UUID];
    })
  );
}

/** The single auto-generated row a query answers with by default. */
export function sampleRowFor(
  query: CapturedQuery,
  table: Table,
  perturb?: Column
): unknown {
  if (query.fields) return sampleFromFields(query.fields, perturb);
  return sampleFromFields(getTableColumns(table), perturb);
}

export function compileWhere(query: CapturedQuery) {
  if (!query.where) return null;
  return new PgDialect().sqlToQuery(query.where);
}

export function createExportDb(
  rows: (query: CapturedQuery) => unknown[] | undefined = () => undefined,
  /** Answer with this one column's value changed (column-coverage test). */
  perturb?: Column
) {
  const queries: CapturedQuery[] = [];

  const select = vi.fn((fields?: Record<string, unknown>) => {
    const query: CapturedQuery = { from: '', joins: [], fields };
    let fromTable: Table | undefined;
    queries.push(query);

    // Resolved in a microtask, i.e. after the synchronous chain has recorded
    // the table and the predicate the answer depends on.
    const self = Promise.resolve().then(
      () => rows(query) ?? [sampleRowFor(query, fromTable as Table, perturb)]
    ) as Promise<unknown[]> & Record<string, unknown>;

    self.from = (table: Table) => {
      fromTable = table;
      query.from = getTableName(table);
      return self;
    };
    const join = (table: Table) => {
      query.joins.push(getTableName(table));
      return self;
    };
    self.innerJoin = join;
    self.leftJoin = join;
    self.where = (predicate: SQL) => {
      query.where = predicate;
      return self;
    };
    self.limit = () => self;
    self.orderBy = () => self;
    return self;
  });

  return { db: { select } as unknown as AppDb, queries };
}
