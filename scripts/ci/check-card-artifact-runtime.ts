/**
 * CI check: the prod deploy runs the card search artifact builder under Bun on
 * Linux, while the unit tests run under Node. This builds an index with the
 * builder's own code (native usearch binary included) under the runtime that
 * executes it, searches it, and exits non-zero on any mismatch.
 *
 *   bun scripts/ci/check-card-artifact-runtime.ts
 */
import {
  DIMS,
  floatToHalf,
  indexTopK,
  searchTexts,
} from '@/lib/ai/matching/cards/search-index/search-core.mjs';
import { buildIndex } from '@/scripts/data/food-cards/search-artifact/artifact-files';

const COUNT = 64;
const value = (k: number) => Math.sin(k * 0.731) + Math.cos(k * 0.017);
const texts = new Uint16Array(COUNT * DIMS);
for (let k = 0; k < texts.length; k++) texts[k] = floatToHalf(value(k));
// Text 5's vector, nudged: its nearest string must still be text 5.
const query = Array.from(
  { length: DIMS },
  (_, j) => value(5 * DIMS + j) + 1e-3
);
const built = buildIndex(texts);
const [hits] = searchTexts(
  {
    texts,
    norms: built.norms,
    textRows: Array.from({ length: COUNT }, (_, i) => [`row_${i}`]),
  },
  [query],
  indexTopK(built.index, built.count),
  10
);
if (hits[0]?.id !== 'row_5' || !(hits[0].similarity > 0.99)) {
  console.error('card artifact runtime check failed', hits.slice(0, 3));
  process.exit(1);
}
const runtime = process.versions.bun
  ? `bun ${process.versions.bun}`
  : `node ${process.versions.node}`;
console.log(
  `card artifact runtime ok (${runtime}, ${process.platform}-${process.arch}): top ${hits[0].id} ${hits[0].similarity.toFixed(4)}`
);
