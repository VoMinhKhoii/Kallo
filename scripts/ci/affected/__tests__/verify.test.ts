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
  for (const name of Object.keys(JOBS)) {
    needs[name] = { result: overrides[name] ?? 'success' };
  }
  needs.changes = { result: overrides.changes ?? 'success', outputs };
  return needs;
}
const PR = { event: 'pull_request', fork: false };
const PUSH = { event: 'push', fork: false };
const EVERYTHING = { web: 'true', migrations: 'true' };
const NOTHING = { web: 'false', migrations: 'false' };

describe('problems', () => {
  it('passes a PR where everything ran', () => {
    expect(
      problems(run(EVERYTHING, { 'container-publish': 'skipped' }), PR)
    ).toEqual([]);
  });

  it('passes a docs-only PR whose gated jobs all skipped', () => {
    const skipped = {
      typecheck: 'skipped',
      'test-shard': 'skipped',
      build: 'skipped',
      e2e: 'skipped',
      migrations: 'skipped',
      'container-build': 'skipped',
      'container-publish': 'skipped',
    };
    expect(problems(run(NOTHING, skipped), PR)).toEqual([]);
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

  it('lets the non-blocking E2E job fail', () => {
    expect(
      problems(
        run(EVERYTHING, { e2e: 'failure', 'container-publish': 'skipped' }),
        PR
      )
    ).toEqual([]);
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
