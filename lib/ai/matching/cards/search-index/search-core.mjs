/**
 * The card vector search, shared by the deploy-time artifact builder (its
 * parity gate) and the container's search worker, so the code the deploy
 * checks is the code that serves. Plain ESM with no imports: the worker runs
 * it under bare Node, outside the Next bundle.
 *
 * Contract, the same as `match_food_card_texts` (migration 20261013070600):
 * per query vector, the nearest PER_QUERY distinct card strings by the cosine
 * of their first PREFIX_DIMS dimensions, rescored with all DIMS, expanded to
 * every food row each string names; a row keeps its best string's similarity.
 * Vectors are stored as half precision, and the query is rounded to half
 * precision first, as the SQL's `::halfvec(768)` cast does.
 */

export const DIMS = 768;
export const PREFIX_DIMS = 256;
export const PER_QUERY = 100;

/** The HNSW index over the unit-length prefixes (inner product = cosine). */
export const INDEX_PARAMS = Object.freeze({
  dimensions: PREFIX_DIMS,
  metric: 'ip',
  quantization: 'f16',
  connectivity: 16,
  expansion_add: 128,
  expansion_search: 200,
  multi: false,
});

const HALF_TO_FLOAT = new Float32Array(65_536);
for (let h = 0; h < 65_536; h++) {
  const sign = h >> 15 ? -1 : 1;
  const exp = (h >> 10) & 0x1f;
  const frac = h & 0x3ff;
  HALF_TO_FLOAT[h] =
    exp === 0
      ? sign * 2 ** -14 * (frac / 1024)
      : exp === 31
        ? frac
          ? Number.NaN
          : sign * Number.POSITIVE_INFINITY
        : sign * 2 ** (exp - 15) * (1 + frac / 1024);
}

/** @param {number} h a binary16 bit pattern */
export function halfToFloat(h) {
  return HALF_TO_FLOAT[h];
}

const scratch = new DataView(new ArrayBuffer(4));

/**
 * Round a number to the nearest binary16 (ties to even), as the bit pattern.
 * @param {number} x
 */
export function floatToHalf(x) {
  scratch.setFloat32(0, x);
  const bits = scratch.getUint32(0);
  const sign = (bits >>> 16) & 0x8000;
  const exp = (bits >>> 23) & 0xff;
  let mant = bits & 0x7fffff;
  if (exp === 0xff) return sign | 0x7c00 | (mant ? 0x200 : 0);
  const e = exp - 127 + 15;
  if (e >= 0x1f) return sign | 0x7c00;
  if (e <= 0) {
    if (e < -10) return sign;
    mant |= 0x800000;
    const shift = 14 - e;
    const half = mant >>> shift;
    const rest = mant & ((1 << shift) - 1);
    const mid = 1 << (shift - 1);
    return sign | (rest > mid || (rest === mid && half & 1) ? half + 1 : half);
  }
  const half = (e << 10) | (mant >>> 13);
  const rest = mant & 0x1fff;
  return (
    sign | (rest > 0x1000 || (rest === 0x1000 && half & 1) ? half + 1 : half)
  );
}

/**
 * Decode pgvector's binary `halfvec_send` output: int16 dimension count,
 * int16 unused, then the components as big-endian binary16.
 * @param {Uint8Array} bytes
 * @returns {Uint16Array} the DIMS components' bit patterns
 */
export function decodeHalfvecSend(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dims = view.getInt16(0);
  if (dims !== DIMS || bytes.byteLength !== 4 + 2 * DIMS) {
    throw new Error(
      `halfvec_send: expected ${DIMS} dims in ${4 + 2 * DIMS} bytes, got ${dims} dims in ${bytes.byteLength}`
    );
  }
  const out = new Uint16Array(DIMS);
  for (let j = 0; j < DIMS; j++) out[j] = view.getUint16(4 + 2 * j);
  return out;
}

/**
 * The unit-length prefix of every stored vector (the index's input) and each
 * vector's full-length norm (for the rescore).
 * @param {Uint16Array} texts count × DIMS half bit patterns
 */
export function prepareTexts(texts) {
  const count = texts.length / DIMS;
  const prefixes = new Float32Array(count * PREFIX_DIMS);
  const norms = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let full = 0;
    let prefix = 0;
    for (let j = 0; j < DIMS; j++) {
      const v = HALF_TO_FLOAT[texts[i * DIMS + j]];
      full += v * v;
      if (j < PREFIX_DIMS) {
        prefixes[i * PREFIX_DIMS + j] = v;
        prefix += v * v;
      }
    }
    norms[i] = Math.sqrt(full);
    const scale = prefix > 0 ? 1 / Math.sqrt(prefix) : 0;
    for (let j = 0; j < PREFIX_DIMS; j++)
      prefixes[i * PREFIX_DIMS + j] *= scale;
  }
  return { count, prefixes, norms };
}

/**
 * A query rounded to half precision (the SQL cast), its norm, and its
 * unit-length prefix.
 * @param {ArrayLike<number>} query
 */
export function prepareQuery(query) {
  if (query.length !== DIMS) {
    throw new Error(`query: expected ${DIMS} dims, got ${query.length}`);
  }
  const full = new Float32Array(DIMS);
  let norm = 0;
  let prefixNorm = 0;
  for (let j = 0; j < DIMS; j++) {
    const v = HALF_TO_FLOAT[floatToHalf(query[j])];
    full[j] = v;
    norm += v * v;
    if (j < PREFIX_DIMS) prefixNorm += v * v;
  }
  const prefix = full.slice(0, PREFIX_DIMS);
  const scale = prefixNorm > 0 ? 1 / Math.sqrt(prefixNorm) : 0;
  for (let j = 0; j < PREFIX_DIMS; j++) prefix[j] *= scale;
  return { full, norm: Math.sqrt(norm), prefix };
}

/**
 * @typedef {{ keys: BigUint64Array }} SearchMatches
 * @typedef {{ search(vectors: Float32Array, k: number, threads: number): unknown }} SearchIndex
 */

/**
 * Nearest strings by prefix via a usearch index (`INDEX_PARAMS`, keys = text
 * positions). One native call for all the queries, on one thread.
 * @param {SearchIndex} index
 * @param {number} count number of stored strings
 * @returns {(prefixes: Float32Array[], k: number) => number[][]}
 */
export function indexTopK(index, count) {
  return (prefixes, k) => {
    if (prefixes.length === 0) return [];
    const batch = new Float32Array(prefixes.length * PREFIX_DIMS);
    prefixes.forEach((p, i) => {
      batch.set(p, i * PREFIX_DIMS);
    });
    const found =
      /** @type {SearchMatches | { get(i: number): SearchMatches }} */ (
        index.search(batch, k, 1)
      );
    // usearch answers a single query with its matches directly and several
    // queries with a batch.
    const matchesOf = (/** @type {number} */ i) =>
      'get' in found ? found.get(i) : found;
    return prefixes.map((_, i) =>
      Array.from(matchesOf(i).keys, Number).filter((key) => key < count)
    );
  };
}

/**
 * Nearest strings by prefix, exactly (every string scored). The builder's
 * reference for the index's recall.
 * @param {Float32Array} storedPrefixes from `prepareTexts`
 * @param {number} count
 * @returns {(prefixes: Float32Array[], k: number) => number[][]}
 */
export function exactTopK(storedPrefixes, count) {
  return (prefixes, k) =>
    prefixes.map((q) => {
      const scores = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        let s = 0;
        const o = i * PREFIX_DIMS;
        for (let j = 0; j < PREFIX_DIMS; j++) s += storedPrefixes[o + j] * q[j];
        scores[i] = s;
      }
      return Array.from(scores.keys())
        .sort((a, b) => scores[b] - scores[a] || a - b)
        .slice(0, k);
    });
}

/**
 * One stored string's similarity to a prepared query: the cosine over all
 * DIMS, as `1 - (embedding <=> query::halfvec(768))` computes it in SQL.
 * @param {{ texts: Uint16Array, norms: Float32Array }} store
 * @param {ReturnType<typeof prepareQuery>} query
 * @param {number} i the string's position
 */
export function stringSimilarity(store, query, i) {
  let dot = 0;
  const o = i * DIMS;
  for (let j = 0; j < DIMS; j++)
    dot += HALF_TO_FLOAT[store.texts[o + j]] * query.full[j];
  const denominator = store.norms[i] * query.norm;
  return denominator > 0 ? dot / denominator : 0;
}

/**
 * The search itself: for each query, rows with their best similarity, best
 * first (the shape `searchCardVectors` returns).
 * @param {{ texts: Uint16Array, norms: Float32Array, textRows: string[][] }} store
 * @param {ArrayLike<number>[]} queries
 * @param {(prefixes: Float32Array[], k: number) => number[][]} topK
 * @param {number} [perQuery]
 * @returns {{ id: string, similarity: number }[][]}
 */
export function searchTexts(store, queries, topK, perQuery = PER_QUERY) {
  const prepared = queries.map(prepareQuery);
  const nearest = topK(
    prepared.map((q) => q.prefix),
    perQuery
  );
  return prepared.map((q, n) => {
    const best = new Map();
    for (const i of nearest[n]) {
      const similarity = stringSimilarity(store, q, i);
      for (const id of store.textRows[i] ?? []) {
        if (!(best.get(id) >= similarity)) best.set(id, similarity);
      }
    }
    return Array.from(best, ([id, similarity]) => ({ id, similarity })).sort(
      (a, b) => b.similarity - a.similarity
    );
  });
}
