import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { GROUPS } from '../affected.mjs';
import { JOBS } from '../verify.mjs';

// The skip rules live in three places: the groups affected.mjs computes,
// verify.mjs's JOBS table, and the gates in ci.yml. These hold them together.

const ROOT = process.cwd();

// ci.yml, read as text: the job blocks under `jobs:`.
const CI = readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
function jobBlocks(): Map<string, string> {
  const body = CI.slice(CI.indexOf('\njobs:\n'));
  const blocks = new Map<string, string>();
  const keys = [...body.matchAll(/^ {2}([a-z0-9-]+):\s*$/gm)];
  keys.forEach((match, i) => {
    const end = keys[i + 1]?.index ?? body.length;
    blocks.set(match[1] as string, body.slice(match.index, end));
  });
  return blocks;
}
function needsOf(block: string): string[] {
  const inline = block.match(/^ {4}needs: \[?([^\]\n]*)\]?$/m);
  if (inline?.[1]) return inline[1].split(',').map((n) => n.trim());
  const list = block.match(/^ {4}needs:\n((?: {6}- .+\n)+)/m);
  return list?.[1]
    ? [...list[1].matchAll(/- (.+)/g)].map((m) => m[1] as string)
    : [];
}

describe('ci.yml agrees with the skip rules', () => {
  const blocks = jobBlocks();
  const gated = [...blocks.keys()].filter((name) => name !== 'ci-passed');

  it('has a verify.mjs rule for every job, and no rule for a missing job', () => {
    expect(Object.keys(JOBS).sort()).toEqual(gated.sort());
  });

  it('makes CI passed wait for every blocking job, and only those', () => {
    const blocking = Object.entries(JOBS)
      .filter(([, job]) => !job.advisory)
      .map(([name]) => name);
    expect(needsOf(blocks.get('ci-passed') ?? '').sort()).toEqual(
      blocking.sort()
    );
  });

  it('gates each job on exactly its own group', () => {
    for (const [name, job] of Object.entries(JOBS)) {
      const block = blocks.get(name) ?? '';
      if (job.selfGated) {
        // No wait on `changes`: the affected step decides, and every step
        // after it runs only on its answer.
        expect([name, block.includes('needs.changes.outputs.')]).toEqual([
          name,
          false,
        ]);
        expect(block).toContain(`group: ${job.group}`);
        const steps = block
          .slice(block.indexOf('id: affected'))
          .split(/\n {6}- /)
          .slice(1);
        expect(steps.length).toBeGreaterThan(0);
        for (const step of steps) {
          expect([
            name,
            step.includes("steps.affected.outputs.run == 'true'"),
          ]).toEqual([name, true]);
        }
        continue;
      }
      for (const group of GROUPS) {
        const gate = `needs.changes.outputs.${group} == 'true'`;
        expect([name, block.includes(gate)]).toEqual([
          name,
          job.group === group,
        ]);
      }
      if (job.group !== 'always') expect(needsOf(block)).toContain('changes');
    }
  });

  it('exposes every group as an output of the changes job', () => {
    const block = blocks.get('changes') ?? '';
    for (const group of GROUPS) {
      expect(block).toContain(
        `${group}: \${{ steps.affected.outputs.${group} }}`
      );
    }
  });

  it('runs the suites dbTestFiles starts from in the migrations job', () => {
    expect(blocks.get('migrations')).toContain('bun run test -- .db.test.ts');
  });
});
