import { readFileSync } from 'node:fs';
import { Index, type IndexConfig } from 'usearch';
import { describe, expect, it } from 'vitest';
import {
  DIMS,
  decodeHalfvecSend,
  exactTopK,
  floatToHalf,
  halfToFloat,
  INDEX_PARAMS,
  indexTopK,
  PREFIX_DIMS,
  prepareTexts,
  searchTexts,
} from '../search-core.mjs';

/** Deterministic pseudo-random numbers (mulberry32), so failures reproduce. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomVector(next: () => number): number[] {
  return Array.from({ length: DIMS }, () => next() * 2 - 1);
}

function toHalves(vectors: number[][]): Uint16Array {
  const out = new Uint16Array(vectors.length * DIMS);
  vectors.forEach((v, i) => {
    v.forEach((x, j) => {
      out[i * DIMS + j] = floatToHalf(x);
    });
  });
  return out;
}

/** The SQL's similarity: cosine of the stored halves and the half-cast query. */
function sqlCosine(stored: Uint16Array, i: number, query: number[]): number {
  let dot = 0;
  let a = 0;
  let b = 0;
  for (let j = 0; j < DIMS; j++) {
    const s = halfToFloat(stored[i * DIMS + j]);
    const q = halfToFloat(floatToHalf(query[j]));
    dot += s * q;
    a += s * s;
    b += q * q;
  }
  return dot / Math.sqrt(a * b);
}

describe('half precision', () => {
  it('encodes known values exactly (ties to even)', () => {
    expect(floatToHalf(1)).toBe(0x3c00);
    expect(floatToHalf(-2)).toBe(0xc000);
    expect(floatToHalf(0.1)).toBe(0x2e66);
    expect(floatToHalf(65_504)).toBe(0x7bff);
    expect(floatToHalf(1e6)).toBe(0x7c00); // overflow → infinity
    expect(floatToHalf(2 ** -24)).toBe(0x0001); // smallest subnormal
    expect(floatToHalf(0)).toBe(0x0000);
    expect(floatToHalf(-0)).toBe(0x8000);
    // 1 + 2^-11 is exactly between 1 and the next half: ties to even (1).
    expect(floatToHalf(1 + 2 ** -11)).toBe(0x3c00);
  });

  it('round-trips every finite half', () => {
    for (let h = 0; h < 0x7c00; h++) {
      expect(floatToHalf(halfToFloat(h))).toBe(h);
      expect(floatToHalf(halfToFloat(h | 0x8000))).toBe(h | 0x8000);
    }
  });
});

describe('decodeHalfvecSend', () => {
  it('reads the header and big-endian components', () => {
    const bytes = new Uint8Array(4 + 2 * DIMS);
    const view = new DataView(bytes.buffer);
    view.setInt16(0, DIMS); // dimension count, big-endian
    view.setUint16(4, 0x3c00); // 1.0
    view.setUint16(6, 0xc000); // -2.0
    view.setUint16(4 + 2 * (DIMS - 1), 0x2e66); // ~0.1

    const halves = decodeHalfvecSend(bytes);

    expect(halves).toHaveLength(DIMS);
    expect(halves[0]).toBe(0x3c00);
    expect(halves[1]).toBe(0xc000);
    expect(halves[DIMS - 1]).toBe(0x2e66);
    expect(halfToFloat(halves[1])).toBe(-2);
  });

  it('rejects a vector of another size', () => {
    const bytes = new Uint8Array(4 + 2 * 256);
    new DataView(bytes.buffer).setInt16(0, 256);
    expect(() => decodeHalfvecSend(bytes)).toThrow(/expected 768 dims/);
  });
});

describe('searchTexts', () => {
  const next = rng(20261015);
  const COUNT = 600;
  const vectors = Array.from({ length: COUNT }, () => randomVector(next));
  const texts = toHalves(vectors);
  const { count, prefixes, norms } = prepareTexts(texts);
  // Two rows share text 0; row "r7" is named by texts 7 and 8.
  const textRows = Array.from({ length: COUNT }, (_, i) => [`r${i}`]);
  textRows[0] = ['shared_a', 'shared_b'];
  textRows[8] = ['r7'];
  const store = { texts, norms, textRows };
  const queries = Array.from({ length: 20 }, () => randomVector(next));

  it('scores rows with the SQL cosine and keeps each row its best string', () => {
    const [hits] = searchTexts(store, [vectors[7]], exactTopK(prefixes, count));
    const r7 = hits.find((h) => h.id === 'r7');
    // Text 7 is the query itself; text 8 also names r7 but scores lower.
    expect(r7?.similarity).toBeCloseTo(sqlCosine(texts, 7, vectors[7]), 6);
    expect(hits[0].id).toBe('r7');
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1].similarity).toBeGreaterThanOrEqual(hits[i].similarity);
    }
  });

  it('expands a string to every row it names', () => {
    const [hits] = searchTexts(store, [vectors[0]], exactTopK(prefixes, count));
    expect(
      hits
        .slice(0, 2)
        .map((h) => h.id)
        .sort()
    ).toEqual(['shared_a', 'shared_b']);
  });

  function buildIndex() {
    const index = new Index(INDEX_PARAMS as unknown as IndexConfig);
    const keys = new BigUint64Array(count);
    for (let i = 0; i < count; i++) keys[i] = BigInt(i);
    index.add(keys, prefixes, 1);
    return index;
  }

  it('answers a single query through a real usearch index', () => {
    // usearch returns a lone query's matches unbatched.
    const [hits] = searchTexts(
      store,
      [vectors[7]],
      indexTopK(buildIndex(), count)
    );
    expect(hits[0].id).toBe('r7');
  });

  it('matches exact search through a real usearch index', () => {
    const viaIndex = searchTexts(
      store,
      queries,
      indexTopK(buildIndex(), count),
      30
    );
    const exact = searchTexts(store, queries, exactTopK(prefixes, count), 30);

    let shared = 0;
    for (let q = 0; q < queries.length; q++) {
      const truth = new Set(exact[q].slice(0, 10).map((h) => h.id));
      shared += viaIndex[q].slice(0, 10).filter((h) => truth.has(h.id)).length;
      // Shared rows carry the same similarity: the rescore is exact.
      const exactSim = new Map(exact[q].map((h) => [h.id, h.similarity]));
      for (const h of viaIndex[q]) {
        const s = exactSim.get(h.id);
        if (s !== undefined) expect(h.similarity).toBeCloseTo(s, 6);
      }
    }
    expect(shared / (queries.length * 10)).toBeGreaterThanOrEqual(0.95);
  });

  it('builds unit-length prefixes', () => {
    for (let i = 0; i < 5; i++) {
      let norm = 0;
      for (let j = 0; j < PREFIX_DIMS; j++)
        norm += prefixes[i * PREFIX_DIMS + j] ** 2;
      expect(norm).toBeCloseTo(1, 5);
    }
  });

  it('rejects a query of the wrong size', () => {
    expect(() =>
      searchTexts(store, [[1, 2, 3]], exactTopK(prefixes, count))
    ).toThrow(/expected 768 dims/);
  });
});

it('imports nothing, so the worker can run it under bare Node', () => {
  const source = readFileSync(
    'lib/ai/matching/cards/search-index/search-core.mjs',
    'utf8'
  );
  expect(source).not.toMatch(/^\s*import\s/m);
  expect(source).not.toMatch(/\brequire\(/);
});
