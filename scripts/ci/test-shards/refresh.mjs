#!/usr/bin/env node
// Rewrites timings.json (each test file's own test time, which the shard
// sequencer balances on) from the unit test shard logs of a green CI run on
// main: the latest one, or the run id given. Needs the GitHub CLI.
//
//   node scripts/ci/test-shards/refresh.mjs [run-id]

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const gh = (...args) =>
  execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const runId =
  process.argv[2] ??
  gh(
    'run',
    'list',
    '--workflow',
    'ci.yml',
    '--branch',
    'main',
    '--status',
    'success',
    '--limit',
    '1',
    '--json',
    'databaseId',
    '-q',
    '.[0].databaseId'
  ).trim();

const jobs = JSON.parse(
  gh('api', `repos/{owner}/{repo}/actions/runs/${runId}/jobs?per_page=100`)
).jobs.filter((job) => job.name.startsWith('Unit Test ('));
if (jobs.length === 0) throw new Error(`Run ${runId} has no unit test shards.`);

// vitest's default reporter: `✓ |node| path/to/file.test.ts (9 tests) 123ms`
// (the duration is left out for very fast files).
const LINE =
  /[✓×↓]\s+\|?(?:node|dom)\|?\s+(\S+\.test\.tsx?)\s+\(\d+ tests?[^)]*\)(?:\s+(\d+)ms)?/;
const timings = {};
for (const job of jobs) {
  const log = gh('api', `repos/{owner}/{repo}/actions/jobs/${job.id}/logs`);
  for (const line of log.replace(/\x1b\[[0-9;]*m/g, '').split('\n')) {
    const match = line.match(LINE);
    if (match) timings[match[1]] = Number(match[2] ?? 0);
  }
}

const sorted = Object.fromEntries(
  Object.entries(timings).sort(([a], [b]) => (a < b ? -1 : 1))
);
const out = path.join(import.meta.dirname, 'timings.json');
writeFileSync(out, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`${Object.keys(sorted).length} files from run ${runId} → ${out}`);
