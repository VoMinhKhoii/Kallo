// Pure decisions for the pre-push gate hook: is this Bash command a push, from
// which directory, and which of CI's fast gates does the pushed diff need.
import path from 'node:path';

// A path argument: double-quoted, single-quoted, or bare.
const ARG = String.raw`("[^"]*"|'[^']*'|[^\s;&|()]+)`;

// `git push` only where a command starts: the string start, after `&&`, `||`,
// `;`, `|`, `(` or a newline, optionally behind `VAR=value` prefixes. A commit
// message that merely mentions "git push" never matches.
const PUSH = new RegExp(
  String.raw`(?:^|&&|\|\||[;|(\n])\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*git\s+(?:-C\s+${ARG}\s+)?push(?=\s|$|[;&|)])([^;&|\n]*)`
);
const CD = new RegExp(
  String.raw`(?:^|&&|[;\n])\s*cd\s+${ARG}\s*(?=&&|;|\n|$)`,
  'g'
);

const unquote = (arg) => arg.replace(/^(["'])(.*)\1$/, '$2');

/**
 * The directory a `git push` in `command` runs in, or null when the command
 * pushes nothing worth gating (no push, a dry run, or a branch/tag deletion).
 */
export function pushDirectory(command, cwd) {
  const match = PUSH.exec(command);
  if (!match) return null;
  const [, gitC, pushArgs] = match;
  if (/(?:^|\s)(?:--dry-run|-n|--delete|-d)(?=\s|$)/.test(pushArgs))
    return null;
  if (/(?:^|\s):\S/.test(pushArgs)) return null; // `origin :branch` deletes
  if (gitC) return path.resolve(cwd, unquote(gitC));

  let dir = cwd;
  for (const cd of command.slice(0, match.index).matchAll(CD)) {
    dir = path.resolve(
      dir,
      unquote(cd[1]).replace(/^~(?=\/|$)/, process.env.HOME ?? '~')
    );
  }
  return dir;
}

const MOBILE = 'apps/mobile-flutter/';
const SCRIPT = /\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;

/**
 * The gates the changed files need, mirroring the fast blocking jobs in
 * `.github/workflows/ci.yml` and `flutter-ci.yml`. `changed` is null when the
 * diff against main is unknown, which runs every web gate.
 */
export function gatesFor(changed) {
  const files = changed ?? ['unknown.ts'];
  const web = files.filter((f) => !f.startsWith(MOBILE));
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
  if (
    web.some(
      (f) =>
        SCRIPT.test(f) ||
        /(?:^|\/)(?:tsconfig[^/]*\.json|package\.json)$/.test(f)
    )
  ) {
    gates.push({ name: 'tsc', cmd: 'bunx', args: ['tsc', '--noEmit'] });
  }
  if (files.some((f) => f.startsWith('supabase/migrations/'))) {
    gates.push({
      name: 'migrations',
      cmd: 'node',
      args: ['scripts/ci/check-migration-timestamps.js'],
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
