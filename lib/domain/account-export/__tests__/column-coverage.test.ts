import { type Column, getTableColumns, getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  createExportDb,
  SAMPLE_UUID,
} from '@/lib/domain/account-export/__fixtures__/export-db';
import { buildDataExport } from '@/lib/domain/account-export/build-export';
import { EXPORT_COVERAGE } from '@/lib/domain/account-export/coverage';
import * as schema from '@/lib/infra/db/schema';

// ---------------------------------------------------------------------------
// Column-level completeness. coverage.test.ts proves every TABLE has an export
// decision; this proves every COLUMN of an exported table does. A column that
// a sibling change adds to a table the export picks from field by field would
// otherwise be dropped silently (it happened twice: auto_share_updated_at and
// friendships.accepted_at).
//
// Method: build the export from the fixture db, then again with one column's
// sample value changed. If the document does not change, the column does not
// reach it and must be listed in that table's `excludedColumns`. Each column
// is tried with the caller as a stranger to the sample rows AND as the owner
// of every sample id, so fields derived from "is this me?" (requestedByMe,
// createdByMe, an invite's counterpart) register too.
// ---------------------------------------------------------------------------

const STRANGER = { id: '11111111-1111-4111-8111-111111111111' };
const OWNER = { id: SAMPLE_UUID };

async function exportJson(user: { id: string }, perturb?: Column) {
  const { db } = createExportDb(undefined, perturb);
  const { exportedAt: _ignored, ...document } = await buildDataExport(db, user);
  return JSON.stringify(document);
}

const exportedTables = (Object.values(schema) as unknown[])
  .filter((value): value is PgTable => is(value, PgTable))
  .flatMap((table) => {
    const entry = EXPORT_COVERAGE[getTableName(table)];
    return entry && 'exported' in entry
      ? [{ table, excluded: entry.excludedColumns ?? {} }]
      : [];
  });

describe('EXPORT_COVERAGE columns', () => {
  it('finds the exported tables (guards the guard)', () => {
    expect(exportedTables.length).toBeGreaterThan(25);
  });

  it.each(
    exportedTables.map(({ table, excluded }) => [
      getTableName(table),
      table,
      excluded,
    ])
  )('%s: every column is exported or excluded with a reason', async (_name, table, excluded) => {
    const baseline = {
      stranger: await exportJson(STRANGER),
      owner: await exportJson(OWNER),
    };
    const columns = Object.values(
      getTableColumns(table as PgTable)
    ) as Column[];
    const dropped: string[] = [];
    const listedButExported: string[] = [];
    for (const column of columns) {
      const reaches =
        (await exportJson(STRANGER, column)) !== baseline.stranger ||
        (await exportJson(OWNER, column)) !== baseline.owner;
      const listed = column.name in (excluded as Record<string, string>);
      if (!reaches && !listed) dropped.push(column.name);
      if (reaches && listed) listedButExported.push(column.name);
    }
    expect(
      dropped,
      'Export these columns, or list them in excludedColumns with a reason (lib/domain/account-export/coverage.ts)'
    ).toEqual([]);
    expect(
      listedButExported,
      'These columns reach the export; drop them from excludedColumns'
    ).toEqual([]);
    const names = new Set(columns.map((column) => column.name));
    expect(
      Object.keys(excluded as Record<string, string>).filter(
        (name) => !names.has(name)
      ),
      'excludedColumns names a column the table no longer has'
    ).toEqual([]);
  });
});
