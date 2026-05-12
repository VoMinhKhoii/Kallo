import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SHARED_DB_APPLIED_MIGRATIONS_QUERY =
  'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version';

export const SHARED_DB_STATE_QUERY = `
WITH checks AS (
  SELECT
    (to_regclass('public.user_profiles') IS NOT NULL)::int AS has_user_profiles,
    (to_regclass('public.vietnamese_food_composition') IS NOT NULL)::int AS has_food_table,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'vietnamese_food_composition'
        AND column_name = 'source_id'
    )::int AS has_food_source_id,
    EXISTS (
      SELECT 1
      FROM pg_trigger AS trigger
      JOIN pg_class AS relation ON relation.oid = trigger.tgrelid
      JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'auth'
        AND relation.relname = 'users'
        AND trigger.tgname = 'on_auth_user_created'
        AND NOT trigger.tgisinternal
    )::int AS has_new_user_trigger
),
food AS (
  SELECT
    CASE
      WHEN (
        SELECT has_food_table = 1 AND has_food_source_id = 1
        FROM checks
      )
      THEN (
        SELECT COUNT(*)::int
        FROM public.vietnamese_food_composition
        WHERE source_id = 1
      )
      ELSE 0
    END AS seeded_food_rows
),
orphans AS (
  SELECT
    CASE
      WHEN (SELECT has_user_profiles = 1 FROM checks)
      THEN (
        SELECT COUNT(*)::int
        FROM auth.users AS auth_user
        LEFT JOIN public.user_profiles AS profile
          ON profile.user_id = auth_user.id
        WHERE profile.user_id IS NULL
      )
      ELSE (
        SELECT COUNT(*)::int
        FROM auth.users
      )
    END AS orphaned_auth_users
)
SELECT
  has_user_profiles,
  has_food_table,
  has_food_source_id,
  has_new_user_trigger,
  seeded_food_rows,
  orphaned_auth_users
FROM checks, food, orphans;
`;

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
      'Could not determine the Supabase project ref from the shared staging DATABASE_URL.'
    );
  }

  if (actualProjectRef !== expectedProjectRef) {
    throw new Error(
      `Shared staging DATABASE_URL points at Supabase project "${actualProjectRef}", but SUPABASE_PROJECT_ID is "${expectedProjectRef}".`
    );
  }

  return actualProjectRef;
}

export function parseSharedDbStateOutput(rawOutput) {
  const trimmedOutput = rawOutput.trim();
  const lines = trimmedOutput.split('\n').filter(Boolean);

  if (lines.length !== 1) {
    throw new Error(
      `Expected a single state row from psql, received ${lines.length}.`
    );
  }

  const [
    hasUserProfiles,
    hasFoodTable,
    hasFoodSourceId,
    hasNewUserTrigger,
    seededFoodRows,
    orphanedAuthUsers,
  ] = lines[0].split('|');

  if (
    hasUserProfiles === undefined ||
    hasFoodTable === undefined ||
    hasFoodSourceId === undefined ||
    hasNewUserTrigger === undefined ||
    seededFoodRows === undefined ||
    orphanedAuthUsers === undefined
  ) {
    throw new Error(`Malformed shared DB state row: ${lines[0]}`);
  }

  const parsedSeededFoodRows = Number.parseInt(seededFoodRows, 10);
  const parsedOrphanedAuthUsers = Number.parseInt(orphanedAuthUsers, 10);

  if (
    !Number.isFinite(parsedSeededFoodRows) ||
    !Number.isFinite(parsedOrphanedAuthUsers)
  ) {
    throw new Error(
      `Malformed shared DB state row (non-numeric counts): ${lines[0]}`
    );
  }

  return {
    hasUserProfiles: hasUserProfiles === '1',
    hasFoodTable: hasFoodTable === '1',
    hasFoodSourceId: hasFoodSourceId === '1',
    hasNewUserTrigger: hasNewUserTrigger === '1',
    seededFoodRows: parsedSeededFoodRows,
    orphanedAuthUsers: parsedOrphanedAuthUsers,
  };
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

function runPsqlStateCheck(databaseUrl) {
  const result = runPsqlQuery(databaseUrl, SHARED_DB_STATE_QUERY, ['-F', '|']);

  if (result.status !== 0) {
    throw new Error(result.stderr || 'psql shared DB validation failed.');
  }

  return parseSharedDbStateOutput(result.stdout);
}

function assertSharedDbState(databaseUrl) {
  const state = runPsqlStateCheck(databaseUrl);

  if (!state.hasUserProfiles) {
    throw new Error('Shared staging DB is missing public.user_profiles.');
  }

  if (!state.hasFoodTable) {
    throw new Error(
      'Shared staging DB is missing public.vietnamese_food_composition.'
    );
  }

  if (!state.hasFoodSourceId) {
    throw new Error(
      'Shared staging DB is missing public.vietnamese_food_composition.source_id.'
    );
  }

  if (state.seededFoodRows <= 0) {
    throw new Error(
      'Shared staging DB has no seeded FAO_VN_2007 rows in vietnamese_food_composition.'
    );
  }

  if (!state.hasNewUserTrigger) {
    throw new Error(
      'Shared staging DB is missing the on_auth_user_created trigger on auth.users.'
    );
  }

  if (state.orphanedAuthUsers !== 0) {
    throw new Error(
      `Shared staging DB has ${state.orphanedAuthUsers} auth.users rows without matching public.user_profiles rows.`
    );
  }

  return state;
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
        'Shared non-prod DB has no supabase_migrations.schema_migrations table. ' +
          'Run the "Cloud Run Staging" workflow against this commit to bootstrap migrations.'
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
      `Shared non-prod DB is missing ${pending.length} migration(s): ${pending.join(', ')}. ` +
        'Run the "Cloud Run Staging" workflow on this commit (or push to the staging branch) to apply migrations via supabase db push, then re-run this deploy.'
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
    console.log(
      `Shared staging DATABASE_URL matches Supabase project ${matchedProjectRef}.`
    );
    return;
  }

  if (command === 'assert-state') {
    const databaseUrl = getRequiredFlag('--db-url');
    const state = assertSharedDbState(databaseUrl);
    console.log(
      `Shared staging DB is ready (seededFoodRows=${state.seededFoodRows}, orphanedAuthUsers=${state.orphanedAuthUsers}).`
    );
    return;
  }

  if (command === 'assert-migrations-applied') {
    const databaseUrl = getRequiredFlag('--db-url');
    const migrationsDir = getRequiredFlag('--migrations-dir');
    const counts = assertMigrationsApplied(databaseUrl, migrationsDir);
    console.log(
      `Shared non-prod DB has all local migrations applied (local=${counts.localCount}, applied=${counts.appliedCount}).`
    );
    return;
  }

  if (command === 'encode-url') {
    const databaseUrl = getRequiredFlag('--db-url');
    console.log(encodeDatabaseUrl(databaseUrl));
    return;
  }

  throw new Error(
    'Usage: node scripts/cloud-run/shared-db.mjs <assert-target|assert-state|assert-migrations-applied|encode-url> [--db-url ...] [--project-ref ...] [--migrations-dir ...]'
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
      error instanceof Error
        ? error.message
        : 'Shared staging validation failed.'
    );
    process.exit(1);
  }
}
