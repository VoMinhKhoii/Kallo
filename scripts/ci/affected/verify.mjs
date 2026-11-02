#!/usr/bin/env node
// The `CI passed` job: one check that is green only when every job the
// `changes` job (affected.mjs) said to run passed, and every skipped job was
// meant to skip. A broken skip rule, or a `changes` job that failed and took
// its dependents down with it, fails here instead of passing as all-skipped.

import { pathToFileURL } from 'node:url';

/**
 * Every job in ci.yml except this one, and when it is meant to run: `group` is
 * the affected.mjs output gating it ('always' for none), `on` limits it to one
 * event, `sameRepo` to non-fork PRs. `advisory` is for a non-blocking
 * (continue-on-error) job that `CI passed` neither waits for nor judges;
 * `ownCondition` for a job whose `if` has inputs this cannot see.
 * `selfGated` jobs always start and decide themselves (.github/actions/
 * affected): they must succeed, and the `ran` they report must match what
 * `changes` decided for their group.
 *
 * @type {Record<string, { group: string, on?: string, sameRepo?: boolean,
 *   advisory?: boolean, ownCondition?: boolean, selfGated?: boolean }>}
 */
export const JOBS = {
  changes: { group: 'always' },
  lint: { group: 'always' },
  typecheck: { group: 'web', selfGated: true },
  'test-shard': { group: 'web', selfGated: true },
  build: { group: 'web', selfGated: true },
  e2e: { group: 'web', advisory: true },
  migrations: { group: 'migrations' },
  'dependency-review': { group: 'deps', ownCondition: true },
  'container-build': { group: 'image', on: 'pull_request', sameRepo: true },
  'container-publish': { group: 'always', on: 'push' },
};

/**
 * The problems with a finished run, empty when it passed.
 *
 * @param {Record<string, { result: string, outputs?: Record<string, string> }>} needs
 *   the workflow's `needs` context
 * @param {{ event: string, fork: boolean }} run
 */
export function problems(needs, run) {
  const changes = needs.changes;
  if (changes?.result !== 'success') {
    return [
      `changes: ${changes?.result ?? 'missing'}, so no skip can be trusted`,
    ];
  }
  const outputs = changes.outputs ?? {};
  const found = [];
  for (const [name, job] of Object.entries(JOBS)) {
    if (job.advisory) continue;
    const result = needs[name]?.result;
    if (result === undefined) {
      found.push(`${name}: not in this job's needs`);
      continue;
    }
    if (job.selfGated) {
      const ran = needs[name]?.outputs?.ran;
      if (result !== 'success') found.push(`${name}: ${result}`);
      else if (ran !== outputs[job.group]) {
        found.push(
          `${name}: ran=${ran ?? 'unset'}, but changes said ${job.group}=${outputs[job.group]}`
        );
      }
      continue;
    }
    const shouldRun =
      (job.on === undefined || job.on === run.event) &&
      !(job.sameRepo && run.fork) &&
      (job.group === 'always' || outputs[job.group] === 'true');
    if (result === 'success') continue;
    if (result === 'skipped' && (!shouldRun || job.ownCondition)) continue;
    found.push(
      shouldRun
        ? `${name}: ${result}`
        : `${name}: ${result}, though it was not meant to run`
    );
  }
  return found;
}

function main() {
  const needs = JSON.parse(process.env.NEEDS ?? '{}');
  const run = {
    event: process.env.GITHUB_EVENT_NAME ?? '',
    fork: process.env.IS_FORK === 'true',
  };
  for (const [name, { result }] of Object.entries(needs)) {
    console.log(`${name}: ${result}`);
  }
  const found = problems(needs, run);
  if (found.length > 0) {
    console.error(`\nCI did not pass:\n- ${found.join('\n- ')}`);
    process.exit(1);
  }
  console.log('\nEvery job that had to run passed.');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
