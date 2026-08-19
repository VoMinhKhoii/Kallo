import { beforeEach, describe, expect, it } from 'vitest';
import { createL4Cache, type L4Cache } from '@/lib/ai/cache/l4-cache';

describe('createL4Cache', () => {
  let cache: L4Cache<{ ingredient: string }>;

  beforeEach(() => {
    cache = createL4Cache<{ ingredient: string }>({
      maxEntries: 3,
      ttlMs: 7 * 24 * 60 * 60 * 1000,
      now: () => 1_000_000,
    });
  });

  it('misses when key is unseen', () => {
    expect(cache.get('k1')).toBeNull();
  });

  it('hits after set', () => {
    cache.set('k1', { ingredient: 'phở' });

    expect(cache.get('k1')).toEqual({ ingredient: 'phở' });
  });

  it('evicts the oldest entry under LRU pressure', () => {
    cache.set('k1', { ingredient: 'a' });
    cache.set('k2', { ingredient: 'b' });
    cache.set('k3', { ingredient: 'c' });
    cache.get('k1');
    cache.set('k4', { ingredient: 'd' });

    expect(cache.get('k2')).toBeNull();
    expect(cache.get('k1')).toEqual({ ingredient: 'a' });
  });

  it('evicts entries past TTL', () => {
    let nowMs = 1_000_000;
    const c = createL4Cache<{ x: number }>({
      maxEntries: 5,
      ttlMs: 1000,
      now: () => nowMs,
    });

    c.set('a', { x: 1 });
    nowMs += 999;
    expect(c.get('a')).toEqual({ x: 1 });
    nowMs += 2;
    expect(c.get('a')).toBeNull();
  });
});
