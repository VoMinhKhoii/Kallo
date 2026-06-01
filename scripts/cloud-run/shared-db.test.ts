import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  encodeDatabaseUrl,
  extractProjectRefFromDatabaseUrl,
  findPendingMigrations,
  parseAppliedMigrationVersions,
  parseSharedDbStateOutput,
  readLocalMigrationVersions,
  selectMigrationFilesForVersions,
  validateProjectRefAlignment,
} from './shared-db.mjs';

describe('shared-db helpers', () => {
  it('extracts the project ref from a direct Supabase connection URL', () => {
    expect(
      extractProjectRefFromDatabaseUrl(
        'postgresql://postgres:secret@db.abcd1234.supabase.co:5432/postgres'
      )
    ).toBe('abcd1234');
  });

  it('extracts the project ref from a Supabase pooler URL', () => {
    expect(
      extractProjectRefFromDatabaseUrl(
        'postgresql://postgres.abcd1234:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'
      )
    ).toBe('abcd1234');
  });

  it('extracts the project ref when the password contains reserved URL characters', () => {
    expect(
      extractProjectRefFromDatabaseUrl(
        'postgresql://postgres:%23weird?p@ss@db.abcd1234.supabase.co:5432/postgres'
      )
    ).toBe('abcd1234');
  });

  it('encodes reserved characters in the password portion of the URL', () => {
    expect(
      encodeDatabaseUrl(
        'postgresql://postgres:p@ss:word?x#y@db.abcd1234.supabase.co:5432/postgres'
      )
    ).toBe(
      'postgresql://postgres:p%40ss%3Aword%3Fx%23y@db.abcd1234.supabase.co:5432/postgres'
    );
  });

  it('returns null when the project ref cannot be derived', () => {
    expect(
      extractProjectRefFromDatabaseUrl(
        'postgresql://postgres:secret@example.com:5432/postgres'
      )
    ).toBeNull();
  });

  it('throws when the database URL and project ref do not align', () => {
    expect(() =>
      validateProjectRefAlignment(
        'postgresql://postgres:secret@db.abcd1234.supabase.co:5432/postgres',
        'wxyz7890'
      )
    ).toThrow(
      'Shared staging DATABASE_URL points at Supabase project "abcd1234", but SUPABASE_PROJECT_ID is "wxyz7890".'
    );
  });

  it('parses the psql state row into a typed object', () => {
    expect(parseSharedDbStateOutput('1|1|1|1|526|0\n')).toEqual({
      hasUserProfiles: true,
      hasFoodTable: true,
      hasFoodSourceId: true,
      hasNewUserTrigger: true,
      seededFoodRows: 526,
      orphanedAuthUsers: 0,
    });
  });

  it('rejects non-numeric row counts', () => {
    expect(() => parseSharedDbStateOutput('1|1|1|1|NaN|oops\n')).toThrow(
      'Malformed shared DB state row (non-numeric counts): 1|1|1|1|NaN|oops'
    );
  });
});

describe('migration assertion helpers', () => {
  let migrationsDir: string;

  beforeEach(() => {
    migrationsDir = mkdtempSync(join(tmpdir(), 'shared-db-migrations-'));
  });

  afterEach(() => {
    rmSync(migrationsDir, { recursive: true, force: true });
  });

  it('reads version prefixes from .sql filenames in the directory', () => {
    writeFileSync(join(migrationsDir, '20260101000000_initial.sql'), '');
    writeFileSync(join(migrationsDir, '20260102000000_add_users.sql'), '');
    writeFileSync(join(migrationsDir, '20260103000000_add_indexes.sql'), '');

    expect(readLocalMigrationVersions(migrationsDir)).toEqual([
      '20260101000000',
      '20260102000000',
      '20260103000000',
    ]);
  });

  it('returns versions in sorted order regardless of filesystem order', () => {
    writeFileSync(join(migrationsDir, '20260103000000_third.sql'), '');
    writeFileSync(join(migrationsDir, '20260101000000_first.sql'), '');
    writeFileSync(join(migrationsDir, '20260102000000_second.sql'), '');

    expect(readLocalMigrationVersions(migrationsDir)).toEqual([
      '20260101000000',
      '20260102000000',
      '20260103000000',
    ]);
  });

  it('ignores non-.sql files', () => {
    writeFileSync(join(migrationsDir, '20260101000000_initial.sql'), '');
    writeFileSync(join(migrationsDir, 'README.md'), '');
    writeFileSync(join(migrationsDir, '20260101000000_snapshot.json.bak'), '');

    expect(readLocalMigrationVersions(migrationsDir)).toEqual([
      '20260101000000',
    ]);
  });

  it('ignores files without a numeric version prefix', () => {
    writeFileSync(join(migrationsDir, '20260101000000_initial.sql'), '');
    writeFileSync(join(migrationsDir, 'manual_fix.sql'), '');
    writeFileSync(join(migrationsDir, 'rollback-2026-01-01.sql'), '');

    expect(readLocalMigrationVersions(migrationsDir)).toEqual([
      '20260101000000',
    ]);
  });

  it('does not recurse into subdirectories like meta/', () => {
    writeFileSync(join(migrationsDir, '20260101000000_initial.sql'), '');
    mkdirSync(join(migrationsDir, 'meta'));
    writeFileSync(join(migrationsDir, 'meta', '_journal.json'), '{}');
    writeFileSync(
      join(migrationsDir, 'meta', '20260101000000_snapshot.json'),
      '{}'
    );

    expect(readLocalMigrationVersions(migrationsDir)).toEqual([
      '20260101000000',
    ]);
  });

  it('deduplicates identical version prefixes', () => {
    writeFileSync(join(migrationsDir, '20260101000000_first_attempt.sql'), '');
    writeFileSync(
      join(migrationsDir, '20260101000000_first_attempt_v2.sql'),
      ''
    );

    expect(readLocalMigrationVersions(migrationsDir)).toEqual([
      '20260101000000',
    ]);
  });

  it('returns an empty array for a directory with no migrations', () => {
    expect(readLocalMigrationVersions(migrationsDir)).toEqual([]);
  });

  it('parses pipe-free single-column psql output (one version per line)', () => {
    expect(
      parseAppliedMigrationVersions(
        '20260101000000\n20260102000000\n20260103000000\n'
      )
    ).toEqual(['20260101000000', '20260102000000', '20260103000000']);
  });

  it('strips whitespace and skips blank lines in psql output', () => {
    expect(
      parseAppliedMigrationVersions(' 20260101000000 \n\n  \n20260102000000\n')
    ).toEqual(['20260101000000', '20260102000000']);
  });

  it('returns an empty array when no migrations have been applied', () => {
    expect(parseAppliedMigrationVersions('')).toEqual([]);
    expect(parseAppliedMigrationVersions('\n\n')).toEqual([]);
  });

  it('finds local versions missing from the applied set', () => {
    expect(
      findPendingMigrations(
        ['20260101000000', '20260102000000', '20260103000000'],
        ['20260101000000']
      )
    ).toEqual(['20260102000000', '20260103000000']);
  });

  it('returns no pending versions when the DB is fully up to date', () => {
    expect(
      findPendingMigrations(
        ['20260101000000', '20260102000000'],
        ['20260101000000', '20260102000000']
      )
    ).toEqual([]);
  });

  it('ignores DB-only versions (one-way diff: local minus applied)', () => {
    expect(
      findPendingMigrations(
        ['20260101000000'],
        ['20260101000000', '20260199999999_manual_hotfix']
      )
    ).toEqual([]);
  });
});

describe('selectMigrationFilesForVersions', () => {
  let migrationsDir: string;

  beforeEach(() => {
    migrationsDir = mkdtempSync(join(tmpdir(), 'shared-db-select-'));
  });

  afterEach(() => {
    rmSync(migrationsDir, { recursive: true, force: true });
  });

  it('maps versions to their .sql file paths, sorted', () => {
    writeFileSync(join(migrationsDir, '20260101000000_first.sql'), '');
    writeFileSync(join(migrationsDir, '20260102000000_second.sql'), '');
    writeFileSync(join(migrationsDir, '20260103000000_third.sql'), '');

    expect(
      selectMigrationFilesForVersions(
        ['20260103000000', '20260101000000'],
        migrationsDir
      )
    ).toEqual([
      `${migrationsDir}/20260101000000_first.sql`,
      `${migrationsDir}/20260103000000_third.sql`,
    ]);
  });

  it('returns an empty array when no versions are requested', () => {
    writeFileSync(join(migrationsDir, '20260101000000_first.sql'), '');
    expect(selectMigrationFilesForVersions([], migrationsDir)).toEqual([]);
  });

  it('drops requested versions that have no matching file', () => {
    writeFileSync(join(migrationsDir, '20260101000000_first.sql'), '');

    expect(
      selectMigrationFilesForVersions(
        ['20260101000000', '20269999999999'],
        migrationsDir
      )
    ).toEqual([`${migrationsDir}/20260101000000_first.sql`]);
  });

  it('matches only prefixed .sql files (no README, no prefix-less .sql)', () => {
    writeFileSync(join(migrationsDir, '20260101000000_first.sql'), '');
    writeFileSync(join(migrationsDir, 'manual_fix.sql'), '');
    writeFileSync(join(migrationsDir, 'README.md'), '');

    expect(
      selectMigrationFilesForVersions(['20260101000000'], migrationsDir)
    ).toEqual([`${migrationsDir}/20260101000000_first.sql`]);
  });
});
