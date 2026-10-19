// Whether a push needs the gates, and which of CI's fast gates a change needs
// from the files it touches.

const MOBILE = 'apps/mobile-flutter/';

/**
 * The commits git's pre-push stdin (`<local ref> <local sha> <remote ref>
 * <remote sha>` per line) publishes, without repeats. A deletion sends an
 * all-zero local sha and publishes nothing.
 */
export function pushedCommits(refLines) {
  const shas = refLines
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[1])
    .filter((sha) => sha !== undefined && !/^0+$/.test(sha));
  return [...new Set(shas)];
}
// Files that cannot break a type check. JSON is not one: TypeScript imports the
// message catalogs and reads their keys.
const PROSE = /\.(?:md|mdx|txt)$/;

/**
 * @typedef {{ name: string, cmd: string, args: string[], cwd?: string,
 *   env?: Record<string, string> }} Gate
 */

/**
 * The gates the changed files need, mirroring the fast blocking jobs in
 * `.github/workflows/ci.yml` and `flutter-ci.yml`. `changed` is null when the
 * diff against main is unknown, which runs every gate.
 */
export function gatesFor(changed) {
  const files = changed ?? [
    'unknown.ts',
    'supabase/migrations/unknown.sql',
    `${MOBILE}unknown.dart`,
  ];
  const web = files.filter((f) => !f.startsWith(MOBILE));
  /** @type {Gate[]} */
  const gates = [
    // The structure gate also scans the Flutter app's Dart sources.
    {
      name: 'structure',
      cmd: 'node',
      args: ['scripts/ci/check-structure/check-structure.mjs', '--strict'],
    },
  ];
  if (web.length > 0)
    gates.push({
      name: 'biome',
      cmd: 'bunx',
      // Warnings never fail CI, so only errors are worth showing the agent.
      args: [
        '@biomejs/biome',
        'ci',
        '--colors=off',
        '--diagnostic-level=error',
        '.',
      ],
    });
  if (web.some((f) => !PROSE.test(f))) {
    gates.push({ name: 'tsc', cmd: 'bunx', args: ['tsc', '--noEmit'] });
  }
  if (files.some((f) => f.startsWith('supabase/migrations/'))) {
    gates.push({
      name: 'migrations',
      cmd: 'node',
      args: ['scripts/ci/check-migration-timestamps.js'],
      // Without a base ref the script skips its "new migrations sort after
      // main's newest" check, the one that fails deploys.
      env: { GITHUB_BASE_REF: 'main' },
    });
  }
  if (files.some((f) => f.startsWith(MOBILE))) {
    // As in flutter-ci.yml: dependencies first. Without them `dart format`
    // misreads the language version and reports files as changed.
    gates.push({
      name: 'flutter pub get',
      cmd: 'flutter',
      args: ['pub', 'get', '--enforce-lockfile'],
      cwd: MOBILE,
    });
    gates.push({
      name: 'dart format',
      cmd: 'dart',
      args: ['format', '--output=none', '--set-exit-if-changed', '.'],
      cwd: MOBILE,
    });
    gates.push({
      name: 'flutter analyze',
      cmd: 'flutter',
      args: ['analyze'],
      cwd: MOBILE,
    });
  }
  return gates;
}
