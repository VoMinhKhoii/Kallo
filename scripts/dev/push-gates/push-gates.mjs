#!/usr/bin/env node
// Claude Code PreToolUse hook (Bash): before an agent's `git push` from a Kallo
// checkout, run the fast gates CI would fail it on, and block the push (exit 2,
// reason on stderr) when one fails. Wired in `.claude/settings.json`.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gatesFor, pushDirectory } from './plan.mjs';

// A GUI-launched session can hand hooks a bare PATH; the gates need node, bun
// and flutter.
const HOME = process.env.HOME ?? '';
const TOOL_DIRS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  `${HOME}/.local/bin`,
  `${HOME}/.bun/bin`,
];
const env = {
  ...process.env,
  PATH: [process.env.PATH, ...TOOL_DIRS].filter(Boolean).join(':'),
  // The output goes back to the agent as text, not to a terminal.
  NO_COLOR: '1',
};

const git = (cwd, ...args) => {
  try {
    return execFileSync('git', args, {
      cwd,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
};

const input = JSON.parse(readFileSync(0, 'utf8'));
const dir = pushDirectory(
  input.tool_input?.command ?? '',
  input.cwd ?? process.cwd()
);
if (!dir || !existsSync(dir)) process.exit(0);

const root = git(dir, 'rev-parse', '--show-toplevel');
// Only gate Kallo checkouts; a push from another repo passes through.
if (
  !root ||
  !existsSync(path.join(root, 'scripts/ci/check-structure/check-structure.mjs'))
)
  process.exit(0);

const base = git(root, 'merge-base', 'HEAD', 'origin/main');
const diff = base ? git(root, 'diff', '--name-only', `${base}...HEAD`) : null;
const changed = diff === null ? null : diff.split('\n').filter(Boolean);
if (changed?.length === 0) process.exit(0);

const failures = [];
for (const gate of gatesFor(changed)) {
  const run = spawnSync(gate.cmd, gate.args, {
    cwd: path.join(root, gate.cwd ?? ''),
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (run.status !== 0) {
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? String(run.error) : ''}`;
    failures.push(
      `--- ${gate.name} (${[gate.cmd, ...gate.args].join(' ')}) ---\n${output.trim().split('\n').slice(-40).join('\n')}`
    );
  }
}

if (failures.length > 0) {
  process.stderr.write(
    `Push blocked: ${failures.length} CI gate(s) fail in ${root}. Fix them, commit, and push again.\n\n${failures.join('\n\n')}\n`
  );
  process.exit(2);
}
