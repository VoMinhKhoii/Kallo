import { describe, expect, it } from 'vitest';
import {
  getEmbeddingCacheStats,
  getMemoizedEmbedding,
  memoizeEmbedding,
} from '../provider-embedding-memo';

describe('provider embedding memo', () => {
  it('evicts the least recently used entry past 5,000', () => {
    for (let i = 0; i < 5_000; i++) memoizeEmbedding(`k${i}`, [i]);
    getMemoizedEmbedding('k0'); // touched: now most recent
    memoizeEmbedding('k5000', [5000]);
    expect(getEmbeddingCacheStats().size).toBe(5_000);
    expect(getMemoizedEmbedding('k0')).toEqual([0]);
    expect(getMemoizedEmbedding('k1')).toBeUndefined();
    expect(getMemoizedEmbedding('k5000')).toEqual([5000]);
  });
});
