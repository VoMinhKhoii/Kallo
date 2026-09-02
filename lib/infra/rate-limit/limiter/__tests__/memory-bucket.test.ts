import { describe, expect, it } from 'vitest';
import { createMemoryBucket } from '../memory-bucket';

const oneTokenPerSecond = { capacity: 1, refillPerSecond: 1 };
const noRefill = { capacity: 1, refillPerSecond: 0 };

function clockedBucket(
  options: { maxKeys?: number; sweepEvery?: number } = {}
) {
  const clock = { ms: 0 };
  const bucket = createMemoryBucket({
    ...options,
    nowMs: () => clock.ms,
  });

  return { bucket, clock };
}

describe('createMemoryBucket', () => {
  it('spends the capacity, then refills at the configured rate', () => {
    const { bucket, clock } = clockedBucket();
    const config = { capacity: 2, refillPerSecond: 1 };

    expect(bucket.tryTake('k', config)).toBe(true);
    expect(bucket.tryTake('k', config)).toBe(true);
    expect(bucket.tryTake('k', config)).toBe(false);

    clock.ms = 999;
    expect(bucket.tryTake('k', config)).toBe(false);

    clock.ms = 1000;
    expect(bucket.tryTake('k', config)).toBe(true);
  });

  it('never refills past capacity', () => {
    const { bucket, clock } = clockedBucket();
    const config = { capacity: 2, refillPerSecond: 1 };

    expect(bucket.tryTake('k', config)).toBe(true);
    clock.ms = 3_600_000;

    expect(bucket.tryTake('k', config)).toBe(true);
    expect(bucket.tryTake('k', config)).toBe(true);
    expect(bucket.tryTake('k', config)).toBe(false);
  });

  it('promotes a key on every hit so eviction takes the least recently used', () => {
    const { bucket } = clockedBucket({ maxKeys: 2, sweepEvery: 1000 });

    expect(bucket.tryTake('a', noRefill)).toBe(true);
    expect(bucket.tryTake('b', noRefill)).toBe(true);
    // Hitting `a` again both exhausts it and moves it to the front of the LRU.
    expect(bucket.tryTake('a', noRefill)).toBe(false);
    // `c` overflows maxKeys — the oldest entry is now `b`, not `a`.
    expect(bucket.tryTake('c', noRefill)).toBe(true);

    // `a` survived: still exhausted.
    expect(bucket.tryTake('a', noRefill)).toBe(false);
    // `b` was evicted: it comes back with a full bucket.
    expect(bucket.tryTake('b', noRefill)).toBe(true);
  });

  it('evicts past maxKeys', () => {
    const { bucket } = clockedBucket({ maxKeys: 2, sweepEvery: 1000 });

    bucket.tryTake('a', noRefill);
    bucket.tryTake('b', noRefill);
    bucket.tryTake('c', noRefill);

    expect(bucket.size()).toBe(2);
  });

  it('sweeps fully refilled idle entries on write', () => {
    const { bucket, clock } = clockedBucket({ sweepEvery: 2 });

    expect(bucket.tryTake('idle', oneTokenPerSecond)).toBe(true);
    expect(bucket.size()).toBe(1);

    // Second write triggers the sweep; `idle` has had 10s to refill 1 token.
    clock.ms = 10_000;
    expect(bucket.tryTake('fresh', oneTokenPerSecond)).toBe(true);

    expect(bucket.size()).toBe(1);
  });

  it('clamps backwards time so a clock step cannot lock a key out', () => {
    const { bucket, clock } = clockedBucket();

    clock.ms = 10_000;
    expect(bucket.tryTake('k', oneTokenPerSecond)).toBe(true);

    // Clock jumps back 5s. Without the clamp this would drain 5 tokens and
    // leave the key at -5, needing 6s instead of 1 to recover.
    clock.ms = 5_000;
    expect(bucket.tryTake('k', oneTokenPerSecond)).toBe(false);

    clock.ms = 6_000;
    expect(bucket.tryTake('k', oneTokenPerSecond)).toBe(true);
  });

  it('refills at the CALLER config, not the one stored on the entry', () => {
    const { bucket, clock } = clockedBucket();

    expect(bucket.tryTake('k', noRefill)).toBe(true);
    expect(bucket.tryTake('k', noRefill)).toBe(false);

    // A policy edit must take effect on the next request. Reading the stored
    // refillPerSecond (0) instead of the caller's would keep this blocked.
    clock.ms = 1000;
    expect(bucket.tryTake('k', oneTokenPerSecond)).toBe(true);
  });
});
