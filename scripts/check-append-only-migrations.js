#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MIGRATIONS_DIR = 'supabase/migrations';
const DISALLOWED_PATTERNS = [
  { label: 'DROP TABLE', regex: /\bDROP\s+TABLE\b/i },
  { label: 'DROP COLUMN', regex: /\bDROP\s+COLUMN\b/i },
  { label: 'RENAME COLUMN', regex: /\bRENAME\s+COLUMN\b/i },
  {
    label: 'ALTER COLUMN TYPE',
    regex:
      /\bALTER\s+COLUMN\b[\s\S]*?(?:\bSET\s+DATA\s+TYPE\b|\bTYPE\b\s+[A-Z_])/i,
  },
];

function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ' ');
}

function normalizeStatement(statement) {
  return statement.replace(/\s+/g, ' ').trim().toUpperCase();
}

function splitStatements(sql) {
  return stripSqlComments(sql)
    .split(';')
    .map((statement) => normalizeStatement(statement))
    .filter(Boolean);
}

function findDisallowedOperations(sql) {
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

function resolveTargetFiles(argv, env) {
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

function main() {
  const files = resolveTargetFiles(process.argv.slice(2), process.env);

  if (files.length === 0) {
    console.log('No migration files selected for append-only validation.');
    process.exit(0);
  }

  let violations = 0;

  for (const file of files) {
    const absolutePath = path.join(process.cwd(), file);
    if (!fs.existsSync(absolutePath)) continue;

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
      '\nAppend-only mode forbids DROP TABLE, DROP COLUMN, RENAME COLUMN, and ALTER COLUMN TYPE in newly changed migrations.'
    );
    process.exit(1);
  }

  console.log(
    `OK: ${files.length} migration file(s) passed append-only validation.`
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  findDisallowedOperations,
  resolveTargetFiles,
  splitStatements,
  stripSqlComments,
};
