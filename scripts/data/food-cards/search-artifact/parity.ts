/**
 * The publish gate. Nothing is uploaded unless, on fixed sample queries (up to
 * 20 stored ingredient query vectors, plus 10 sums of adjacent stored strings,
 * so a database without the query table still gets samples):
 *
 *   recall     the index's top 30 rows match an exact (every-string) search's
 *              top 30: ≥ 0.97 on average, and ≥ 0.8 for at least 90% of
 *              samples. Not a per-sample floor: a blend-like query whose
 *              nearest strings sit nearly tied can legitimately score low
 *              (prod, 230 samples: one at 0.37, 10 under 0.9, mean 0.978),
 *              while a broken build scores ~0.03 on every sample.
 *   agreement  today's `match_food_card_texts` answers every sample, and every
 *              row it returns has a string naming it whose similarity,
 *              computed by this code, equals the database's (within 1e-4);
 *              and today's top 10 rows mostly appear in our top 30 (≥ 0.8 on
 *              average)
 *
 * Recall is measured against exact search, not the database's HNSW, which is
 * itself approximate. The agreement check compares per string, not per row: a
 * row's best similarity depends on which strings each search's top 100
 * holds, and the two approximate searches legitimately differ at that edge
 * (prod, 2026-10-15: a row's best string was in the database's top 100 but
 * outside the exact top 100). The string-level check still catches
 * byte-order, precision and normalisation mistakes.
 */
import {
  DIMS,
  exactTopK,
  halfToFloat,
  indexTopK,
  prepareQuery,
  searchTexts,
  stringSimilarity,
} from '@/lib/ai/matching/cards/search-index/search-core.mjs';
import type { ReadOnlySql } from './connect';

/** A connection or a transaction: the gate only issues SELECTs. */
type Queryable = Pick<ReadOnlySql, 'unsafe'>;

type Hit = { id: string; similarity: number };

export interface ParityInput {
  store: { texts: Uint16Array; norms: Float32Array; textRows: string[][] };
  prefixes: Float32Array;
  count: number;
  index: Parameters<typeof indexTopK>[0];
}

export interface ParityReport {
  samples: number;
  minRecall: number;
  meanRecall: number;
  /** Share of samples with recall ≥ 0.8. */
  recallAtLeast08: number;
  meanDbTop10Found: number;
  maxSimilarityGap: number;
  passed: boolean;
}

const top = (hits: Hit[], n: number) => hits.slice(0, n).map((h) => h.id);

/** Real stored query vectors when the table has them, plus pairs of strings. */
export async function sampleQueries(
  sql: Queryable,
  texts: Uint16Array
): Promise<number[][]> {
  const [table] = await sql.unsafe<{ present: boolean }[]>(
    "SELECT to_regclass('public.ingredient_query_embeddings') IS NOT NULL AS present"
  );
  const real = table?.present
    ? (
        await sql.unsafe<{ e: string }[]>(
          `SELECT embedding::text AS e FROM ingredient_query_embeddings
           WHERE embedding IS NOT NULL ORDER BY md5(name_vi) LIMIT 20`
        )
      ).map((r) => JSON.parse(r.e) as number[])
    : [];
  const count = texts.length / DIMS;
  const pairs: number[][] = [];
  for (let k = 0; k < 10 && count > 1; k++) {
    const a = Math.floor((k * (count - 1)) / 10);
    const b = Math.min(count - 1, a + 1);
    pairs.push(
      Array.from(
        { length: DIMS },
        (_, j) =>
          halfToFloat(texts[a * DIMS + j]) + halfToFloat(texts[b * DIMS + j])
      )
    );
  }
  return [...real, ...pairs];
}

export async function checkParity(
  sql: Queryable,
  input: ParityInput,
  queries: number[][]
): Promise<ParityReport> {
  if (queries.length === 0) {
    return {
      samples: 0,
      minRecall: 0,
      meanRecall: 0,
      recallAtLeast08: 0,
      meanDbTop10Found: 0,
      maxSimilarityGap: 1,
      passed: false,
    };
  }
  const viaIndex = searchTexts(
    input.store,
    queries,
    indexTopK(input.index, input.count)
  );
  const exact = searchTexts(
    input.store,
    queries,
    exactTopK(input.prefixes, input.count)
  );
  const literal = `{${queries.map((v) => `"[${v.join(',')}]"`).join(',')}}`;
  const dbRows = await sql.unsafe<
    { query_index: number; food_composition_id: string; similarity: number }[]
  >(
    'SELECT query_index, food_composition_id, similarity FROM match_food_card_texts($1::vector[])',
    [literal]
  );
  const db: Hit[][] = queries.map(() => []);
  for (const r of dbRows) {
    const q = Number(r.query_index) - 1;
    const similarity = Number(r.similarity);
    if (!Number.isInteger(q) || q < 0 || q >= queries.length) {
      throw new Error(
        `match_food_card_texts returned query_index ${r.query_index}`
      );
    }
    if (!Number.isFinite(similarity)) {
      throw new Error(
        `match_food_card_texts returned similarity ${r.similarity}`
      );
    }
    db[q].push({ id: r.food_composition_id, similarity });
  }
  for (const list of db) list.sort((a, b) => b.similarity - a.similarity);

  const stringsOfRow = new Map<string, number[]>();
  input.store.textRows.forEach((rows, i) => {
    for (const id of rows) {
      const list = stringsOfRow.get(id);
      if (list) list.push(i);
      else stringsOfRow.set(id, [i]);
    }
  });
  const recalls: number[] = [];
  const dbFound: number[] = [];
  let maxGap = 0;
  queries.forEach((_, q) => {
    const truth = new Set(top(exact[q], 30));
    const ours = top(viaIndex[q], 30);
    // An empty answer is a failure, never a pass.
    recalls.push(
      truth.size === 0
        ? 0
        : ours.filter((id) => truth.has(id)).length / truth.size
    );
    const prepared = prepareQuery(queries[q]);
    for (const h of db[q]) {
      // The closest of this row's strings to the database's value; a row the
      // artifact does not know at all counts as a full mismatch.
      let gap = 1;
      for (const i of stringsOfRow.get(h.id) ?? []) {
        const s = stringSimilarity(input.store, prepared, i);
        gap = Math.min(gap, Math.abs(s - h.similarity));
      }
      maxGap = Math.max(maxGap, gap);
    }
    const dbTop = top(db[q], 10);
    const ourTop = new Set(ours);
    dbFound.push(
      dbTop.length === 0
        ? 0
        : dbTop.filter((id) => ourTop.has(id)).length / dbTop.length
    );
  });
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const report = {
    samples: queries.length,
    minRecall: Math.min(...recalls),
    meanRecall: mean(recalls),
    recallAtLeast08: recalls.filter((r) => r >= 0.8).length / recalls.length,
    meanDbTop10Found: mean(dbFound),
    maxSimilarityGap: maxGap,
  };
  return {
    ...report,
    passed:
      queries.length > 0 &&
      db.every((hits) => hits.length > 0) &&
      report.meanRecall >= 0.97 &&
      report.recallAtLeast08 >= 0.9 &&
      report.meanDbTop10Found >= 0.8 &&
      report.maxSimilarityGap <= 1e-4,
  };
}
