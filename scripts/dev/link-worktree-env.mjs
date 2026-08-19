#!/usr/bin/env node
import {
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  statSync,
  symlinkSync,
} from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const normalizedCwd = cwd.replace(/\\/g, '/');

if (!normalizedCwd.includes('/.claude/worktrees/')) {
  process.exit(0);
}

const worktreeMarker = '/.claude/worktrees/';
const worktreeIndex = normalizedCwd.lastIndexOf(worktreeMarker);
if (worktreeIndex === -1) {
  process.exit(0);
}

const repoRoot = cwd.substring(0, worktreeIndex);
const src = path.join(repoRoot, '.env.local');
const dst = path.join(cwd, '.env.local');

if (existsSync(dst)) {
  process.exit(0);
}

try {
  if (lstatSync(dst).isSymbolicLink()) {
    process.exit(0);
  }
} catch {
  // dst does not exist
}

if (!existsSync(src) || !statSync(src).isFile()) {
  process.exit(0);
}

try {
  symlinkSync(src, dst);
  console.log(`linked .env.local -> ${src}`);
} catch {
  try {
    copyFileSync(src, dst, constants.COPYFILE_EXCL);
    console.log(`copied .env.local -> ${src}`);
  } catch (copyErr) {
    if (
      typeof copyErr === 'object' &&
      copyErr !== null &&
      'code' in copyErr &&
      copyErr.code === 'EEXIST'
    ) {
      process.exit(0);
    }
    console.error('Failed to link or copy .env.local:', copyErr);
    process.exitCode = 1;
  }
}
