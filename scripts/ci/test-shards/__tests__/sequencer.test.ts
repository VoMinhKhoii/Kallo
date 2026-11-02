import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { assignShards, type Costed, costOf } from '../sequencer';

const loadsOf = (
  items: Costed[],
  shardOf: Map<string, number>,
  count: number
) => {
  const loads = Array.from({ length: count }, () => 0);
  for (const item of items) loads[shardOf.get(item.key) ?? 0] += item.cost;
  return loads;
};

describe('assignShards', () => {
  it('gives every file to exactly one shard', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      key: `f${i}.test.ts`,
      cost: (i % 7) + 0.5,
    }));
    const shardOf = assignShards(items, 6);
    expect(shardOf.size).toBe(50);
    for (const shard of shardOf.values()) {
      expect(shard).toBeGreaterThanOrEqual(0);
      expect(shard).toBeLessThan(6);
    }
  });

  it('computes the same split whatever order the files arrive in', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      key: `f${i}.test.ts`,
      cost: i % 3,
    }));
    expect(assignShards([...items].reverse(), 4)).toEqual(
      assignShards(items, 4)
    );
  });

  it('balances the real suite far better than a split by file count', () => {
    const timings: Record<string, number> = JSON.parse(
      readFileSync(
        path.join(process.cwd(), 'scripts/ci/test-shards/timings.json'),
        'utf8'
      )
    );
    const items = Object.entries(timings).map(([key, ms]) => ({
      key,
      cost: costOf(ms, key.endsWith('.tsx')),
    }));
    const loads = loadsOf(items, assignShards(items, 6), 6);
    const mean = loads.reduce((a, b) => a + b, 0) / 6;
    // Greedy heaviest-first lands within a few percent of the mean.
    expect(Math.max(...loads) / mean).toBeLessThan(1.05);
  });
});

describe('costOf', () => {
  it('weighs test time and jsdom per the fitted model', () => {
    expect(costOf(1000, false)).toBeCloseTo(0.79);
    expect(costOf(0, true)).toBeCloseTo(0.91);
  });
});
