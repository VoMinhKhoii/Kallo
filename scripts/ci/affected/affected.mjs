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

// A change to how CI runs, or to the dependency set, can break any job.
const RUNS_EVERYTHING = [
  /^\.github\/workflows\/ci\.yml$/,
  /^\.github\/actions\//,
  /^scripts\/ci\/affected\//,
  /^package\.json$/,
  /^bun\.lock$/,
];

// Paths no web job builds, imports or reads: the Flutter app, and prose and
// agent files unless a unit test lives in their folder (repoFacts()). MDX is
// not prose (the docs pages import it), and neither is Markdown under .github/
// (the security review reads its prompt from there).
const FLUTTER = /^apps\/mobile-flutter\//;
const PROSE = [
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

// The PR image build checks what only the Docker build can break: the
// Dockerfile, what it copies by hand (repoFacts() reads those paths from it),
// the standalone output settings, and the card search worker check. Plain
// `next build` breakage is the Build job's, which runs the same build. Pushes
// to main always build the image, before any deploy can use it.
const IMAGE = [
  /^Dockerfile$/,
  /^\.dockerignore$/,
  /^next\.config\.ts$/,
  /^public\//,
  /^scripts\/ci\/card-index\//,
];

// Dependency Review diffs the dependency manifests, and GitHub Actions
// versions count: with none of these changed it has nothing to report.
// Matched by file name, so a manifest in a new folder (or a new ecosystem's
// usual file) is still caught.
const MANIFEST =
  /(^|\/)(package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|pubspec\.(yaml|lock)|Gemfile(\.lock)?|Podfile(\.lock)?|Package\.(swift|resolved)|(build|settings)\.gradle(\.kts)?|gradle\.lockfile|requirements[^/]*\.txt|pyproject\.toml|Pipfile(\.lock)?|poetry\.lock|uv\.lock|go\.(mod|sum)|Cargo\.(toml|lock))$/;
const DEPS = [MANIFEST, /^\.github\/(workflows|actions)\//];

const isProse = (file) => PROSE.some((rule) => rule.test(file));

/**
 * Whether one changed file needs each group. `repo` comes from repoFacts().
 *
 * @type {Record<string, (file: string, repo: { dbFiles: Set<string>,
 *   testDirs: string[], imageFiles: string[] }) => boolean>}
 */
const RULES = {
  web: (file, repo) =>
    !(FLUTTER.test(file) || isProse(file)) ||
    repo.testDirs.some((dir) => file.startsWith(dir)),
  migrations: (file, repo) =>
    repo.dbFiles.has(file) || MIGRATIONS.some((rule) => rule.test(file)),
  image: (file, repo) =>
    IMAGE.some((rule) => rule.test(file)) ||
    repo.imageFiles.some(
      (copied) => file === copied || file.startsWith(`${copied}/`)
    ),
  deps: (file) => DEPS.some((rule) => rule.test(file)),
};
export const GROUPS = Object.keys(RULES);
const ALL = Object.fromEntries(GROUPS.map((group) => [group, true]));

/**
 * The groups `files` (repo-relative paths) need. `files` is null when the diff
 * is unknown, and `repo` (repoFacts()) when the checkout could not be listed.
 *
 * @param {string[] | null} files
 * @param {{ dbFiles: Set<string>, testDirs: string[], imageFiles: string[] } | null} repo
 * @returns {Record<string, boolean>}
 */
export function groupsFor(files, repo) {
  if (files === null || files.length === 0 || repo === null) return { ...ALL };
  if (files.some((file) => RUNS_EVERYTHING.some((rule) => rule.test(file)))) {
    return { ...ALL };
  }
  return Object.fromEntries(
    GROUPS.map((group) => [
      group,
      files.some((file) => RULES[group](file, repo)),
    ])
  );
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
 * `testDirs`: each prose or agent folder that holds a unit test (the folder
 * above `__tests__`), since the test may read any file in it.
 * `imageFiles`: the paths the Dockerfile copies into the image by hand, and
 * every repo file they import.
 */
export function repoFacts(root) {
  const tests = git(root, ['ls-files', '-z', '*.test.ts', '*.test.tsx']);
  if (tests === null) return null;
  const testDirs = tests.filter(isProse).map((test) => {
    const dir = path.posix.dirname(test);
    const owner =
      path.posix.basename(dir) === '__tests__' ? path.posix.dirname(dir) : dir;
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
    imageFiles: imageInputs(root),
  };
}

/** What the Dockerfile copies by hand, and every repo file those files import. */
function imageInputs(root) {
  const copies = dockerfileCopies(
    readFileSync(path.join(root, 'Dockerfile'), 'utf8')
  );
  const files = copies.filter((copy) => {
    const full = path.join(root, copy);
    return existsSync(full) && statSync(full).isFile();
  });
  return [...new Set([...copies, ...importClosure(root, files)])];
}

/**
 * The repo paths a Dockerfile copies by hand (`/app/<path>`), leaving out the
 * build output and node_modules, which package.json and bun.lock cover.
 */
export function dockerfileCopies(dockerfile) {
  const paths = [...dockerfile.matchAll(/\/app\/([^\s\\]+)/g)].map(
    ([, p]) => p
  );
  return [
    ...new Set(
      paths.filter(
        (p) => !p.startsWith('.next') && !p.startsWith('node_modules')
      )
    ),
  ];
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

  // A job that gates itself (.github/actions/affected) names its group and
  // reads `run`; the `changes` job reads every group.
  const own = process.env.AFFECTED_GROUP;
  if (own && !GROUPS.includes(own)) {
    throw new Error(
      `Unknown AFFECTED_GROUP "${own}"; groups: ${GROUPS.join(', ')}`
    );
  }
  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    appendFileSync(
      output,
      GROUPS.map((group) => `${group}=${groups[group]}\n`).join('') +
        (own ? `run=${groups[own]}\n` : '')
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY && !own) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
