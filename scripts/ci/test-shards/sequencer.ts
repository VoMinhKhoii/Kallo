import { closeSync, openSync, readFileSync, readSync } from 'node:fs';
import path from 'node:path';
import { BaseSequencer, type TestSpecification } from 'vitest/node';

// Vitest's own `--shard` splits files by a hash of their path, so slow files
// cluster: on 2026-11-02 six shards of ~110 files took 26-51s. This splits by
// estimated cost instead. Fitted on that run, a shard took about
// 12.5 s + 0.68 s per second of its files' own tests + 0.8 s per jsdom file,
// so a file costs 0.68 s per test-second, 0.8 s more in jsdom, and a 0.11 s
// share of the fixed part. timings.json holds each file's test time from a
// main CI run (refresh.mjs rewrites it); a file it does not know yet costs the
// median.

const TIMINGS = 'scripts/ci/test-shards/timings.json';
const PER_TEST_SECOND = 0.68;
const JSDOM_EXTRA = 0.8;
const PER_FILE = 0.11;

export interface Costed {
  key: string;
  cost: number;
}

/** The cost of one test file, in estimated shard seconds. */
export function costOf(testMs: number, jsdom: boolean): number {
  return (
    (PER_TEST_SECOND * testMs) / 1000 + (jsdom ? JSDOM_EXTRA : 0) + PER_FILE
  );
}

/**
 * The shard (0-based) of every item: heaviest first, each onto the shard with
 * the least cost so far (ties to the lowest shard, then by key, so every
 * shard computes the same split).
 */
export function assignShards(
  items: Costed[],
  count: number
): Map<string, number> {
  const loads = Array.from({ length: count }, () => 0);
  const order = [...items].sort(
    (a, b) => b.cost - a.cost || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
  );
  const shardOf = new Map<string, number>();
  for (const item of order) {
    let lightest = 0;
    for (let shard = 1; shard < count; shard++) {
      if ((loads[shard] ?? 0) < (loads[lightest] ?? 0)) lightest = shard;
    }
    loads[lightest] = (loads[lightest] ?? 0) + item.cost;
    shardOf.set(item.key, lightest);
  }
  return shardOf;
}

/** Whether a `.ts` test opts into jsdom on its first line. */
function optsIntoJsdom(file: string): boolean {
  const fd = openSync(file, 'r');
  try {
    const head = Buffer.alloc(120);
    const read = readSync(fd, head, 0, head.length, 0);
    return head
      .subarray(0, read)
      .toString('utf8')
      .includes('@vitest-environment jsdom');
  } finally {
    closeSync(fd);
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export class CostSequencer extends BaseSequencer {
  override async shard(files: TestSpecification[]) {
    const { root, shard } = this.ctx.config;
    if (!shard) return files;
    const timings: Record<string, number> = JSON.parse(
      readFileSync(path.join(root, TIMINGS), 'utf8')
    );
    const fallback = median(Object.values(timings));
    const keyed = files.map((spec) => ({
      spec,
      key: path.relative(root, spec.moduleId).split(path.sep).join('/'),
    }));
    const shardOf = assignShards(
      keyed.map(({ spec, key }) => ({
        key,
        cost: costOf(
          timings[key] ?? fallback,
          key.endsWith('.tsx') || optsIntoJsdom(spec.moduleId)
        ),
      })),
      shard.count
    );
    return keyed
      .filter(({ key }) => shardOf.get(key) === shard.index - 1)
      .map(({ spec }) => spec);
  }
}
