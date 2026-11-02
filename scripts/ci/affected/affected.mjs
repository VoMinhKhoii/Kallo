#!/usr/bin/env node
// Which of CI's job groups a pull request needs, from the files it changes.
// The `changes` job in .github/workflows/ci.yml runs this and gates the other
// jobs on its outputs; the `CI passed` job (verify.mjs) then fails the run if
// a job was skipped that this said to run.
//
// Every rule errs toward running: a file no rule knows about runs the web
// jobs, a change to CI itself or to the dependencies runs everything, and so
// does a diff that cannot be read. Pushes to main always run everything.

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const GROUPS = ['web', 'migrations'];
const ALL = Object.fromEntries(GROUPS.map((group) => [group, true]));

// A change to how CI runs, or to the dependency set, can break any job.
const RUNS_EVERYTHING = [
  /^\.github\/workflows\/ci\.yml$/,
  /^\.github\/actions\//,
  /^scripts\/ci\/affected\//,
  /^package\.json$/,
  /^bun\.lock$/,
];

// Paths no web job builds, imports or reads, except a folder under one that
// holds a unit test (repoFacts()). MDX is not prose (the docs pages import
// it), and neither is Markdown under .github/ (the security review reads its
// prompt from there).
const NOT_WEB = [
  /^apps\/mobile-flutter\//,
  /^docs\//,
  /^\.claude\//,
  /^\.agents\//,
  /^\.tuturuuu\//,
  /^(?!\.github\/).*\.md$/,
];

// The migrations job applies supabase/ to a fresh database, lints it, and runs
// the `*.db.test.ts` suites against it. Those suites and every file they import
// come from repoFacts(), so they need no entry here.
const MIGRATIONS = [
  /^supabase\//,
  /^scripts\/ci\/check-migration-timestamps\.js$/,
  /^lib\/__test-utils__\//,
  /^tsconfig\.json$/,
];

const isNotWeb = (file) => NOT_WEB.some((rule) => rule.test(file));

/**
 * The groups `files` (repo-relative paths) need. `files` is null when the diff
 * is unknown, and `repo` (repoFacts()) when the checkout could not be listed.
 *
 * @param {string[] | null} files
 * @param {{ dbFiles: Iterable<string>, testDirs: string[] } | null} repo
 * @returns {Record<string, boolean>}
 */
export function groupsFor(files, repo) {
  if (files === null || files.length === 0 || repo === null) return { ...ALL };
  if (files.some((file) => RUNS_EVERYTHING.some((rule) => rule.test(file)))) {
    return { ...ALL };
  }
  const db = new Set(repo.dbFiles);
  const tested = (file) => repo.testDirs.some((dir) => file.startsWith(dir));
  return {
    web: files.some((file) => !isNotWeb(file) || tested(file)),
    migrations: files.some(
      (file) => db.has(file) || MIGRATIONS.some((rule) => rule.test(file))
    ),
  };
}

// `from '…'`, `import '…'`, `import('…')`, `vi.mock('…')`, `require('…')`.
const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bvi\.mock\(\s*|\brequire\(\s*)['"]([^'"]+)['"]/g;
const SUFFIXES = ['', '.ts', '.tsx', '.mts', '.mjs', '.js', '/index.ts'];

/** The repo file `specifier` in `fromFile` names, or null for a package. */
export function resolveImport(root, fromFile, specifier) {
  let base;
  if (specifier.startsWith('@/')) base = path.join(root, specifier.slice(2));
  else if (specifier.startsWith('.')) {
    base = path.resolve(root, path.dirname(fromFile), specifier);
  } else return null; // a package: package.json and bun.lock cover those
  for (const suffix of SUFFIXES) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return path.relative(root, candidate);
    }
  }
  return null;
}

/**
 * `entries` and every repo file they import, transitively, as repo-relative
 * paths. Follows the `@/` alias and relative paths; packages are left out.
 *
 * @param {string} root
 * @param {string[]} entries
 */
export function importClosure(root, entries) {
  const seen = new Set();
  const pending = [...entries];
  while (pending.length > 0) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(path.join(root, file), 'utf8');
    for (const [, specifier] of source.matchAll(SPECIFIER)) {
      const resolved = resolveImport(root, file, specifier);
      if (resolved && !seen.has(resolved)) pending.push(resolved);
    }
  }
  return seen;
}

/**
 * What groupsFor() needs from the checkout, or null when git cannot list it.
 * `dbFiles`: every file the `*.db.test.ts` suites load, test config included.
 * `testDirs`: each folder under a NOT_WEB path that holds a unit test (the
 * folder above `__tests__`), since the test may read any file in it. Vitest
 * does not collect Flutter's tests, so those are left out.
 */
export function repoFacts(root) {
  const tests = git(root, ['ls-files', '-z', '*.test.ts', '*.test.tsx']);
  if (tests === null) return null;
  const testDirs = tests
    .filter(
      (test) => isNotWeb(test) && !test.startsWith('apps/mobile-flutter/')
    )
    .map((test) => {
      const dir = path.posix.dirname(test);
      const owner =
        path.posix.basename(dir) === '__tests__'
          ? path.posix.dirname(dir)
          : dir;
      return `${owner}/`;
    });
  const suites = tests.filter((test) => test.endsWith('.db.test.ts'));
  return {
    dbFiles: importClosure(root, [
      ...suites,
      'vitest.config.ts',
      'vitest.setup.ts',
    ]),
    testDirs: [...new Set(testDirs)],
  };
}

function git(root, args) {
  try {
    const out = execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    return out.split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

/** The files a PR changes, or null when the diff cannot be read. */
export function changedFiles(root, baseSha, headSha) {
  if (!baseSha || !headSha) return null;
  // --no-renames lists a rename as its old and its new path, so both count.
  return git(root, [
    'diff',
    '--name-only',
    '-z',
    '--no-renames',
    `${baseSha}...${headSha}`,
  ]);
}

function main() {
  const root = process.cwd();
  const isPr = process.env.GITHUB_EVENT_NAME === 'pull_request';
  const files = isPr
    ? changedFiles(root, process.env.BASE_SHA, process.env.HEAD_SHA)
    : null;
  const groups = groupsFor(files, repoFacts(root));

  const why = !isPr
    ? 'not a pull request: everything runs'
    : files === null
      ? 'the diff could not be read: everything runs'
      : `${files.length} changed file(s)`;
  const lines = [`Affected jobs (${why})`, ''];
  for (const group of GROUPS) {
    lines.push(`- ${group}: ${groups[group] ? 'runs' : 'skipped'}`);
  }
  console.log(lines.join('\n'));

  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    appendFileSync(
      output,
      GROUPS.map((group) => `${group}=${groups[group]}\n`).join('')
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
