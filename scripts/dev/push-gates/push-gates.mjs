#!/usr/bin/env node
// Run by `.githooks/pre-push` before an agent's push: the fast gates CI would
// fail the push on, in the checkout being pushed. A failing gate exits 1, which
// makes git refuse the push and shows this output to the agent.
//
// The gates run on the working tree, the same files the agent just edited, not
// on a clean checkout of the pushed commit: an uncommitted fix can let a push
// through that CI then fails. Checking out the commit would need a stash or a
// second worktree per push, which this shared checkout rules out.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gatesFor, pushesCode } from './plan.mjs';

// The gates need node, bun and flutter even from a bare PATH.
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

const git = (...args) => {
  try {
    return execFileSync('git', args, {
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
};

// Git passes one line per ref being pushed; deleting refs publishes no code.
if (!pushesCode(readFileSync(0, 'utf8'))) process.exit(0);

const root = git('rev-parse', '--show-toplevel') ?? process.cwd();
// Committed, staged, unstaged and untracked changes since main.
const base = git('merge-base', 'HEAD', 'origin/main');
const diff = base ? git('diff', '--name-only', base) : null;
const untracked = git('ls-files', '--others', '--exclude-standard');
const changed =
  diff === null
    ? null
    : [...new Set(`${diff}\n${untracked ?? ''}`.split('\n').filter(Boolean))];
if (changed?.length === 0) process.exit(0);

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
      `--- ${gate.name} (${[gate.cmd, ...gate.args].join(' ')}) ---\n${output.trim().split('\n').slice(-40).join('\n')}`
    );
  }
}

if (failures.length > 0) {
  process.stderr.write(
    `Push blocked: ${failures.length} CI gate(s) fail in ${root}. Fix them, commit, and push again. Do not bypass with --no-verify.\n\n${failures.join('\n\n')}\n`
  );
  process.exit(1);
}
