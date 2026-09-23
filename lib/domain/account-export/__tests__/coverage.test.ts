import { getTableColumns, getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { createExportDb } from '@/lib/domain/account-export/__fixtures__/export-db';
import { buildDataExport } from '@/lib/domain/account-export/build-export';
import { EXPORT_COVERAGE } from '@/lib/domain/account-export/coverage';
import * as schema from '@/lib/infra/db/schema';

// ---------------------------------------------------------------------------
// The completeness guard. "Download everything Kallo holds for you" is only
// true while every table is accounted for, and nothing in the type system ties
// a new table to the export. These tests do: they read the tables straight off
// the Drizzle schema module and hold them against EXPORT_COVERAGE, so adding a
// table without deciding its export fate fails CI with the table's name.
// ---------------------------------------------------------------------------

/** Column names that link a row to a person (an auth.users id). */
const USER_LINK_COLUMNS = new Set([
  'user_id',
  'actor_id',
  'recipient_id',
  'sender_id',
  'created_by',
  'from_user_id',
  'to_user_id',
  'user_low',
  'user_high',
  'requested_by',
  'coach_id',
  'client_id',
]);

const tables = (Object.values(schema) as unknown[])
  .filter((value): value is PgTable => is(value, PgTable))
  .map((table) => ({
    name: getTableName(table),
    columns: Object.values(getTableColumns(table)).map((column) => column.name),
  }));

const userLinkedTables = tables
  .filter((table) =>
    table.columns.some((column) => USER_LINK_COLUMNS.has(column))
  )
  .map((table) => table.name)
  .sort();

describe('EXPORT_COVERAGE', () => {
  it('introspects the real schema (guards the guard)', () => {
    // If introspection silently found nothing, every check below would pass.
    expect(tables.length).toBeGreaterThan(40);
    expect(userLinkedTables).toEqual(
      expect.arrayContaining([
        'user_profiles',
        'friendships',
        'chat_group_messages',
        'notifications',
        'meal_share_invites',
        'coach_assignments',
      ])
    );
  });

  it('classifies every table that has a user-linked column', () => {
    const missing = userLinkedTables.filter(
      (name) => !(name in EXPORT_COVERAGE)
    );
    expect(
      missing,
      `Add these tables to EXPORT_COVERAGE in lib/domain/account-export/coverage.ts — export them, or exclude them with a reason: ${missing.join(', ')}`
    ).toEqual([]);
  });

  it('classifies every other table too', () => {
    const missing = tables
      .map((table) => table.name)
      .filter((name) => !(name in EXPORT_COVERAGE));
    expect(
      missing,
      `Unclassified tables (a user link may hide behind a column name the list above does not know): ${missing.join(', ')}`
    ).toEqual([]);
  });

  it('names only tables that exist', () => {
    const known = new Set<string>(tables.map((table) => table.name));
    const stale = Object.keys(EXPORT_COVERAGE).filter(
      (name) => !known.has(name)
    );
    expect(stale).toEqual([]);
  });

  it('gives every exclusion a real reason', () => {
    // Excluding a user-linked table is allowed, but it must say why in a
    // sentence, not a placeholder.
    for (const [name, entry] of Object.entries(EXPORT_COVERAGE)) {
      if ('excluded' in entry) {
        expect(entry.excluded.length, name).toBeGreaterThan(30);
      }
    }
  });

  it('points every exported table at a key the export really has', async () => {
    const { db } = createExportDb();
    const document = await buildDataExport(db, {
      id: '11111111-1111-4111-8111-111111111111',
    });

    for (const [name, entry] of Object.entries(EXPORT_COVERAGE)) {
      if (!('exported' in entry)) continue;
      let cursor: unknown = document;
      for (const key of entry.exported.split('.')) {
        expect(
          cursor !== null && typeof cursor === 'object' && key in cursor,
          `${name} → ${entry.exported}`
        ).toBe(true);
        cursor = (cursor as Record<string, unknown>)[key];
      }
    }
  });
});
