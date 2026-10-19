// Which of CI's fast gates a change needs, from the files it touches.

const MOBILE = 'apps/mobile-flutter/';
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
 * diff against main is unknown, which runs every web gate.
 */
export function gatesFor(changed) {
  const files = changed ?? ['unknown.ts'];
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
    gates.push({
      name: 'flutter analyze',
      cmd: 'flutter',
      args: ['analyze'],
      cwd: MOBILE,
    });
  }
  return gates;
}
