#!/usr/bin/env node
// Run by `.githooks/pre-push` before an agent's push: the fast gates CI would
// fail the push on, run against exactly the commit being pushed. A failing gate
// exits 1, which makes git refuse the push and shows this output to the agent.
//
// When the checkout is that commit with nothing uncommitted or untracked, the
// gates run in place. Otherwise they run in a throwaway checkout of the pushed
// commit (sharing node_modules), so an uncommitted
// fix cannot let a broken commit through and unrelated work in progress cannot
// block a good one.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  symlinkSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gatesFor, pushedCommits } from './plan.mjs';

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

const gitRaw = (...args) => {
  try {
    return execFileSync('git', args, {
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
};
const git = (...args) => gitRaw(...args)?.trim() ?? null;
// File names NUL-separated (`-z`): git otherwise quotes and escapes non-ASCII
// names ("apps/mobile-flutter/lib/m\303\263n.dart"), hiding their folder.
const gitFiles = (...args) => gitRaw(...args, '-z')?.split('\0') ?? null;

// Untracked build state the gates need, shared into a throwaway checkout. The
// Flutter gates fetch their own packages (`flutter pub get`).
const SHARED = ['node_modules'];

// A checkout of `sha` to run the gates in, and how to clean it up.
function checkoutOf(root, sha) {
  const status = git('status', '--porcelain');
  if (git('rev-parse', 'HEAD') === sha && status === '') {
    return { dir: root, cleanup: () => {} };
  }
  const dir = mkdtempSync(path.join(os.tmpdir(), 'kallo-push-gates-'));
  if (git('worktree', 'add', '--detach', dir, sha) === null) {
    throw new Error(`could not check out ${sha} to run the gates`);
  }
  for (const shared of SHARED) {
    const from = path.join(root, shared);
    if (existsSync(from))
      symlinkSync(realpathSync(from), path.join(dir, shared));
  }
  return {
    dir,
    cleanup: () => git('worktree', 'remove', '--force', dir),
  };
}

function failingGates(root, sha) {
  // Every file the pushed commit changes since it left main.
  const base = git('merge-base', sha, 'origin/main');
  const diff = base
    ? gitFiles('diff', '--name-only', '--no-renames', base, sha)
    : null;
  const changed = diff === null ? null : diff.filter(Boolean);
  if (changed?.length === 0) return [];

  const checkout = checkoutOf(root, sha);
  try {
    const failures = [];
    for (const gate of gatesFor(changed)) {
      const run = spawnSync(gate.cmd, gate.args, {
        cwd: path.join(checkout.dir, gate.cwd ?? ''),
        env: { ...env, ...gate.env },
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      });
      if (run.status !== 0) {
        const output = `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? String(run.error) : ''}`;
        failures.push(
          `--- ${gate.name} on ${sha.slice(0, 10)} (${[gate.cmd, ...gate.args].join(' ')}) ---\n${output.trim().split('\n').slice(-40).join('\n')}`
        );
      }
    }
    return failures;
  } finally {
    checkout.cleanup();
  }
}

const root = git('rev-parse', '--show-toplevel') ?? process.cwd();
const failures = pushedCommits(readFileSync(0, 'utf8')).flatMap((sha) =>
  failingGates(root, sha)
);
if (failures.length > 0) {
  process.stderr.write(
    `Push blocked: ${failures.length} CI gate(s) fail on the commit being pushed. Fix them, commit, and push again. Do not bypass with --no-verify.\n\n${failures.join('\n\n')}\n`
  );
  process.exit(1);
}
