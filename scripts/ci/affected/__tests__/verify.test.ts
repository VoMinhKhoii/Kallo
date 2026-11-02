import { describe, expect, it } from 'vitest';

import { JOBS, problems } from '../verify.mjs';

type Needs = Record<
  string,
  { result: string; outputs?: Record<string, string> }
>;

/** Every job passed, with the given outputs; `overrides` set results. */
function run(
  outputs: Record<string, string>,
  overrides: Record<string, string> = {}
): Needs {
  const needs: Needs = {};
  for (const [name, job] of Object.entries(JOBS)) {
    if (job.advisory) continue;
    needs[name] = { result: overrides[name] ?? 'success' };
    // A self-gated job reports what it decided, which matches `changes`.
    if (job.selfGated) {
      needs[name].outputs = { ran: outputs[job.group] ?? 'false' };
    }
  }
  needs.changes = { result: overrides.changes ?? 'success', outputs };
  return needs;
}
const PR = { event: 'pull_request', fork: false };
const PUSH = { event: 'push', fork: false };
const EVERYTHING = {
  web: 'true',
  migrations: 'true',
  image: 'true',
  deps: 'true',
};
const NOTHING = {
  web: 'false',
  migrations: 'false',
  image: 'false',
  deps: 'false',
};

describe('problems', () => {
  it('passes a PR where everything ran', () => {
    expect(
      problems(run(EVERYTHING, { 'container-publish': 'skipped' }), PR)
    ).toEqual([]);
  });

  // Self-gated jobs (Type Check, the shards, Build) still succeed on a
  // docs-only PR: they start, find nothing to do, and report ran=false.
  it('passes a docs-only PR whose gated jobs all skipped', () => {
    const skipped = {
      migrations: 'skipped',
      'container-build': 'skipped',
      'container-publish': 'skipped',
    };
    expect(problems(run(NOTHING, skipped), PR)).toEqual([]);
  });

  it('fails a self-gated job whose decision differs from changes', () => {
    const needs = run(EVERYTHING, { 'container-publish': 'skipped' });
    needs.build = { result: 'success', outputs: { ran: 'false' } };
    expect(problems(needs, PR)).toEqual([
      'build: ran=false, but changes said web=true',
    ]);
    const quiet = run(NOTHING, {
      migrations: 'skipped',
      'container-build': 'skipped',
      'container-publish': 'skipped',
    });
    quiet.typecheck = { result: 'success', outputs: { ran: 'true' } };
    delete quiet.build.outputs;
    expect(problems(quiet, PR)).toEqual([
      'typecheck: ran=true, but changes said web=false',
      'build: ran=unset, but changes said web=false',
    ]);
  });

  it('fails a job skipped though its group had to run', () => {
    expect(
      problems(
        run(EVERYTHING, {
          'test-shard': 'skipped',
          'container-publish': 'skipped',
        }),
        PR
      )
    ).toEqual(['test-shard: skipped']);
  });

  // A failed `changes` job skips every job that needs it; without this, the
  // whole run would read as an intended skip.
  it('fails when the changes job did not succeed', () => {
    for (const result of ['failure', 'cancelled', 'skipped']) {
      expect(problems(run(NOTHING, { changes: result }), PR)).toEqual([
        `changes: ${result}, so no skip can be trusted`,
      ]);
    }
  });

  it('fails any failed or cancelled job', () => {
    expect(
      problems(
        run(EVERYTHING, {
          migrations: 'failure',
          lint: 'cancelled',
          'container-publish': 'skipped',
        }),
        PR
      )
    ).toEqual(['lint: cancelled', 'migrations: failure']);
  });

  // E2E is non-blocking: CI passed does not wait for it, so it is not in the
  // needs at all, and its own check reports how it went.
  it('neither waits for nor judges the advisory E2E job', () => {
    const needs = run(EVERYTHING, { 'container-publish': 'skipped' });
    expect(needs.e2e).toBeUndefined();
    expect(problems(needs, PR)).toEqual([]);
  });

  it('skips the PR image build only when nothing image-related changed', () => {
    const web = { web: 'true', migrations: 'false', image: 'false' };
    const skipped = {
      migrations: 'skipped',
      'container-build': 'skipped',
      'container-publish': 'skipped',
    };
    expect(problems(run(web, skipped), PR)).toEqual([]);
    expect(problems(run({ ...web, image: 'true' }, skipped), PR)).toEqual([
      'container-build: skipped',
    ]);
  });

  it('expects no PR image build on a fork, and no publish on a PR', () => {
    expect(
      problems(
        run(EVERYTHING, {
          'container-build': 'skipped',
          'container-publish': 'skipped',
        }),
        { event: 'pull_request', fork: true }
      )
    ).toEqual([]);
  });

  it('requires the image publish on a push, and no PR image build', () => {
    expect(
      problems(run(EVERYTHING, { 'container-build': 'skipped' }), PUSH)
    ).toEqual([]);
    expect(
      problems(
        run(EVERYTHING, {
          'container-build': 'skipped',
          'container-publish': 'skipped',
        }),
        PUSH
      )
    ).toEqual(['container-publish: skipped']);
  });

  it('accepts Dependency Review skipping on its own condition', () => {
    expect(
      problems(
        run(EVERYTHING, {
          'dependency-review': 'skipped',
          'container-build': 'skipped',
        }),
        PUSH
      )
    ).toEqual([]);
  });

  it('fails a job missing from the needs list', () => {
    const needs = run(EVERYTHING, { 'container-publish': 'skipped' });
    delete needs.build;
    expect(problems(needs, PR)).toEqual(["build: not in this job's needs"]);
  });
});
