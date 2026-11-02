import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SHARED_DB_APPLIED_MIGRATIONS_QUERY =
  'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version';

export function extractProjectRefFromDatabaseUrl(databaseUrl) {
  const directConnectionMatch = databaseUrl.match(
    /@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\//i
  );

  if (directConnectionMatch?.[1]) {
    return directConnectionMatch[1];
  }

  const poolerConnectionMatch = databaseUrl.match(
    /^[a-z]+:\/\/([^:]+):.*@[^/]*pooler\.supabase\.com(?::\d+)?\//i
  );

  if (poolerConnectionMatch?.[1]) {
    const usernameParts = decodeURIComponent(poolerConnectionMatch[1]).split(
      '.'
    );

    if (usernameParts.length >= 2) {
      return usernameParts.at(-1);
    }
  }

  return null;
}

export function encodeDatabaseUrl(rawDatabaseUrl) {
  const protoEnd = rawDatabaseUrl.indexOf('://') + 3;
  const userEnd = rawDatabaseUrl.indexOf(':', protoEnd);
  const atHost = rawDatabaseUrl.lastIndexOf('@');

  if (userEnd === -1 || atHost === -1) {
    return rawDatabaseUrl;
  }

  const password = rawDatabaseUrl.slice(userEnd + 1, atHost);

  return (
    rawDatabaseUrl.slice(0, userEnd + 1) +
    encodeURIComponent(password) +
    rawDatabaseUrl.slice(atHost)
  );
}

export function validateProjectRefAlignment(databaseUrl, expectedProjectRef) {
  const actualProjectRef = extractProjectRefFromDatabaseUrl(databaseUrl);

  if (!actualProjectRef) {
    throw new Error(
      'Could not determine the Supabase project ref from the DATABASE_URL.'
    );
  }

  if (actualProjectRef !== expectedProjectRef) {
    throw new Error(
      `DATABASE_URL points at Supabase project "${actualProjectRef}", but the expected project is "${expectedProjectRef}".`
    );
  }

  return actualProjectRef;
}

/**
 * Run a one-shot psql query against `databaseUrl` and return `{ status,
 * stdout, stderr }`. Always uses the unaligned (`-A`) tuples-only (`-t`)
 * mode with `ON_ERROR_STOP=1` so callers get predictable, parseable output
 * and a non-zero exit on SQL errors. Pass `extraArgs` for query-specific
 * formatting (e.g. `['-F', '|']` for pipe-delimited rows). Error
 * classification is left to the caller so each query can produce a tailored
 * remediation message.
 */
function runPsqlQuery(databaseUrl, query, extraArgs = []) {
  const encodedDatabaseUrl = encodeDatabaseUrl(databaseUrl);

  const result = spawnSync(
    'psql',
    [
      encodedDatabaseUrl,
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-A',
      '-t',
      ...extraArgs,
      '-c',
      query,
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr.trim(),
  };
}

export function readLocalMigrationVersions(migrationsDir) {
  const entries = readdirSync(migrationsDir, { withFileTypes: true });
  const versions = new Set();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.sql')) continue;

    const match = entry.name.match(/^(\d+)_/);
    if (match) versions.add(match[1]);
  }

  return [...versions].sort();
}

export function parseAppliedMigrationVersions(rawOutput) {
  return rawOutput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function findPendingMigrations(localVersions, appliedVersions) {
  const applied = new Set(appliedVersions);
  return localVersions.filter((version) => !applied.has(version));
}

function runPsqlMigrationsCheck(databaseUrl) {
  const result = runPsqlQuery(databaseUrl, SHARED_DB_APPLIED_MIGRATIONS_QUERY);

  if (result.status !== 0) {
    if (/relation .*schema_migrations.* does not exist/i.test(result.stderr)) {
      throw new Error(
        'The DB has no supabase_migrations.schema_migrations table. ' +
          'Apply migrations with supabase db push, then re-run this deploy.'
      );
    }
    throw new Error(result.stderr || 'psql migrations check failed.');
  }

  return parseAppliedMigrationVersions(result.stdout);
}

function assertMigrationsApplied(databaseUrl, migrationsDir) {
  const localVersions = readLocalMigrationVersions(migrationsDir);
  const appliedVersions = runPsqlMigrationsCheck(databaseUrl);
  const pending = findPendingMigrations(localVersions, appliedVersions);

  if (pending.length > 0) {
    throw new Error(
      `The DB is missing ${pending.length} migration(s): ${pending.join(', ')}. ` +
        'Apply them with supabase db push, then re-run this deploy.'
    );
  }

  return {
    localCount: localVersions.length,
    appliedCount: appliedVersions.length,
  };
}

function getRequiredFlag(flagName) {
  const flagIndex = process.argv.indexOf(flagName);

  if (flagIndex === -1 || !process.argv[flagIndex + 1]) {
    throw new Error(`Missing required flag ${flagName}.`);
  }

  return process.argv[flagIndex + 1];
}

function main() {
  const command = process.argv[2];

  if (command === 'assert-target') {
    const databaseUrl = getRequiredFlag('--db-url');
    const projectRef = getRequiredFlag('--project-ref');
    const matchedProjectRef = validateProjectRefAlignment(
      databaseUrl,
      projectRef
    );
    console.log(`DATABASE_URL matches Supabase project ${matchedProjectRef}.`);
    return;
  }

  if (command === 'assert-migrations-applied') {
    const databaseUrl = getRequiredFlag('--db-url');
    const migrationsDir = getRequiredFlag('--migrations-dir');
    const counts = assertMigrationsApplied(databaseUrl, migrationsDir);
    console.log(
      `The DB has all local migrations applied (local=${counts.localCount}, applied=${counts.appliedCount}).`
    );
    return;
  }

  if (command === 'encode-url') {
    const databaseUrl = getRequiredFlag('--db-url');
    console.log(encodeDatabaseUrl(databaseUrl));
    return;
  }

  throw new Error(
    'Usage: node scripts/cloud-run/shared-db.mjs <assert-target|assert-migrations-applied|encode-url> [--db-url ...] [--project-ref ...] [--migrations-dir ...]'
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'DB validation failed.'
    );
    process.exit(1);
  }
}
