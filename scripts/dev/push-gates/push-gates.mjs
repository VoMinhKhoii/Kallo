#!/usr/bin/env node
// Claude Code PreToolUse hook (Bash): before an agent's `git push` from a Kallo
// checkout, run the fast gates CI would fail it on, and block the push (exit 2,
// reason on stderr) when one fails. Wired in `.claude/settings.json`.
//
// The gates run on the working tree, the same files the agent just edited, not
// on a clean checkout of the pushed commit: an uncommitted fix can let a push
// through that CI then fails. Checking out the commit would need a stash or a
// second worktree per push, which this shared checkout rules out.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gatesFor } from './plan.mjs';
import { pushDirectories } from './push-command.mjs';

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

// The failing gates of one checkout, as printable blocks.
function failingGates(root) {
  // Committed, staged, unstaged and untracked changes since main: a command
  // like `git commit -m … && git push` is checked before its commit exists.
  const base = git(root, 'merge-base', 'HEAD', 'origin/main');
  const diff = base ? git(root, 'diff', '--name-only', base) : null;
  const untracked = git(root, 'ls-files', '--others', '--exclude-standard');
  const changed =
    diff === null
      ? null
      : [...new Set(`${diff}\n${untracked ?? ''}`.split('\n').filter(Boolean))];
  if (changed?.length === 0) return [];

  const failures = [];
  for (const gate of gatesFor(changed)) {
    const run = spawnSync(gate.cmd, gate.args, {
      cwd: path.join(root, gate.cwd ?? ''),
      env: { ...env, ...gate.env },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (run.status !== 0) {
      const output = `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? String(run.error) : ''}`;
      failures.push(
        `--- ${gate.name} in ${root} (${[gate.cmd, ...gate.args].join(' ')}) ---\n${output.trim().split('\n').slice(-40).join('\n')}`
      );
    }
  }
  return failures;
}

const input = JSON.parse(readFileSync(0, 'utf8'));
const cwd = input.cwd ?? process.cwd();
const roots = new Set();
for (const dir of pushDirectories(input.tool_input?.command ?? '', cwd)) {
  // A directory we could not resolve (an unknown `$VAR`) falls back to where
  // the command started, rather than letting the push through unchecked.
  const root = git(existsSync(dir) ? dir : cwd, 'rev-parse', '--show-toplevel');
  // Only gate Kallo checkouts; a push from another repo passes through.
  if (
    root &&
    existsSync(
      path.join(root, 'scripts/ci/check-structure/check-structure.mjs')
    )
  )
    roots.add(root);
}

const failures = [...roots].flatMap(failingGates);
if (failures.length > 0) {
  process.stderr.write(
    `Push blocked: ${failures.length} CI gate(s) fail. Fix them, commit, and push again.\n\n${failures.join('\n\n')}\n`
  );
  process.exit(2);
}
