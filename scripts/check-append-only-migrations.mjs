import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = 'supabase/migrations';
const IDENTIFIER_PATTERN = '(?:"[^"]+"|[A-Z_][A-Z0-9_$]*)';
const DISALLOWED_PATTERNS = [
  { label: 'DROP TABLE', regex: /\bDROP\s+TABLE\b/i },
  {
    label: 'DROP COLUMN',
    regex: new RegExp(
      String.raw`^ALTER\s+TABLE(?:\s+IF\s+EXISTS)?[\s\S]*?\bDROP\s+(?:COLUMN\s+)?(?:IF\s+EXISTS\s+)?${IDENTIFIER_PATTERN}(?:\s+(?:CASCADE|RESTRICT))?$`,
      'i'
    ),
  },
  {
    label: 'RENAME COLUMN',
    regex: new RegExp(
      String.raw`^ALTER\s+TABLE(?:\s+IF\s+EXISTS)?[\s\S]*?\bRENAME\s+(?:COLUMN\s+)?${IDENTIFIER_PATTERN}\s+TO\s+${IDENTIFIER_PATTERN}$`,
      'i'
    ),
  },
  {
    label: 'ALTER COLUMN TYPE',
    regex: new RegExp(
      String.raw`^ALTER\s+TABLE(?:\s+IF\s+EXISTS)?[\s\S]*?\bALTER\s+(?:COLUMN\s+)?${IDENTIFIER_PATTERN}\s+(?:SET\s+DATA\s+TYPE|TYPE)\b`,
      'i'
    ),
  },
];

export function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ' ');
}

export function normalizeStatement(statement) {
  return statement.replace(/\s+/g, ' ').trim().toUpperCase();
}

export function splitStatements(sql) {
  return stripSqlComments(sql)
    .split(';')
    .map((statement) => normalizeStatement(statement))
    .filter(Boolean);
}

export function findDisallowedOperations(sql) {
  const statements = splitStatements(sql);

  return statements.flatMap((statement) =>
    DISALLOWED_PATTERNS.filter(({ regex }) => regex.test(statement)).map(
      ({ label }) => ({
        label,
        statement,
      })
    )
  );
}

function listAllMigrationFiles() {
  const directory = path.join(process.cwd(), MIGRATIONS_DIR);
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => path.join(MIGRATIONS_DIR, file));
}

function getGitDiffFiles(range) {
  const output = execFileSync(
    'git',
    ['diff', '--name-only', range, '--', `${MIGRATIONS_DIR}/`],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  return output
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter((file) => file.endsWith('.sql'));
}

export function resolveTargetFiles(argv, env) {
  if (argv.length > 0) {
    return argv;
  }

  try {
    if (env.GITHUB_BASE_REF) {
      return getGitDiffFiles(`origin/${env.GITHUB_BASE_REF}...HEAD`);
    }

    if (env.GITHUB_EVENT_BEFORE && env.GITHUB_SHA) {
      return getGitDiffFiles(`${env.GITHUB_EVENT_BEFORE}..${env.GITHUB_SHA}`);
    }
  } catch (error) {
    console.warn(
      `WARN: Unable to resolve changed migration files from git diff: ${error instanceof Error ? error.message : error}`
    );
  }

  return listAllMigrationFiles();
}

export function main() {
  const files = resolveTargetFiles(process.argv.slice(2), process.env);

  if (files.length === 0) {
    console.log('No migration files selected for append-only validation.');
    process.exit(0);
  }

  let violations = 0;

  for (const file of files) {
    const absolutePath = path.join(process.cwd(), file);
    if (!fs.existsSync(absolutePath)) {
      violations += 1;
      console.error(`ERROR: Append-only migration violation in ${file}`);
      console.error(
        '  - DELETED MIGRATION: migration files must not be removed'
      );
      continue;
    }

    const sql = fs.readFileSync(absolutePath, 'utf8');
    const matches = findDisallowedOperations(sql);

    if (matches.length === 0) continue;

    violations += matches.length;
    console.error(`ERROR: Append-only migration violation in ${file}`);
    for (const match of matches) {
      console.error(`  - ${match.label}: ${match.statement}`);
    }
  }

  if (violations > 0) {
    console.error(
      '\nAppend-only mode forbids deleting migrations, DROP TABLE, DROP COLUMN, RENAME COLUMN, and ALTER COLUMN TYPE in newly changed migrations.'
    );
    process.exit(1);
  }

  console.log(
    `OK: ${files.length} migration file(s) passed append-only validation.`
  );
}

const entrypoint = process.argv[1] ? path.resolve(process.argv[1]) : undefined;

if (entrypoint === fileURLToPath(import.meta.url)) {
  main();
}
