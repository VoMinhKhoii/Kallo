import { describe, expect, it } from 'vitest';
import {
  DIMS,
  exactTopK,
  floatToHalf,
  searchTexts,
} from '@/lib/ai/matching/cards/search-index/search-core.mjs';
import { buildIndex } from '../artifact-files';
import type { ReadOnlySql } from '../connect';
import { checkParity } from '../parity';

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const next = rng(7);
const COUNT = 400;
const vectors = Array.from({ length: COUNT }, () =>
  Array.from({ length: DIMS }, () => next() * 2 - 1)
);
const texts = new Uint16Array(COUNT * DIMS);
vectors.forEach((v, i) => {
  v.forEach((x, j) => {
    texts[i * DIMS + j] = floatToHalf(x);
  });
});
const textRows = Array.from({ length: COUNT }, (_, i) => [`r${i}`]);
const queries = Array.from({ length: 12 }, () =>
  Array.from({ length: DIMS }, () => next() * 2 - 1)
);

function input(stored: Uint16Array) {
  const built = buildIndex(stored);
  return {
    store: { texts: stored, norms: built.norms, textRows },
    prefixes: built.prefixes,
    count: built.count,
    index: built.index,
  };
}

/** A stand-in for the database function: exact search on the true vectors. */
function databaseAnswering(stored: Uint16Array) {
  const truth = input(stored);
  const results = searchTexts(
    truth.store,
    queries,
    exactTopK(truth.prefixes, truth.count)
  );
  const rows = results.flatMap((hits, q) =>
    hits.map((h) => ({
      query_index: q + 1,
      food_composition_id: h.id,
      similarity: h.similarity,
    }))
  );
  return { unsafe: async () => rows } as unknown as ReadOnlySql;
}

describe('checkParity', () => {
  it('passes when the artifact holds the database vectors', async () => {
    const report = await checkParity(
      databaseAnswering(texts),
      input(texts),
      queries
    );
    expect(report.passed).toBe(true);
    expect(report.maxSimilarityGap).toBeLessThan(1e-6);
  });

  it('fails when the vectors were decoded with the wrong byte order', async () => {
    const swapped = texts.map((h) => ((h & 0xff) << 8) | (h >> 8));
    const report = await checkParity(
      databaseAnswering(texts),
      input(swapped),
      queries
    );
    expect(report.passed).toBe(false);
  });

  it('fails when the database knows a row the artifact lacks', async () => {
    const db = databaseAnswering(texts);
    const missing = input(texts);
    missing.store.textRows = textRows.map(() => []);
    const report = await checkParity(db, missing, queries);
    expect(report.passed).toBe(false);
    expect(report.maxSimilarityGap).toBe(1);
  });

  it('fails with no samples', async () => {
    const report = await checkParity(
      databaseAnswering(texts),
      input(texts),
      []
    );
    expect(report.passed).toBe(false);
  });
});
