/**
 * The publish gate. Nothing is uploaded unless, on fixed sample queries:
 *
 *   recall     the index's top 30 rows match an exact (every-string) search's
 *              top 30: ≥ 0.9 for every sample, ≥ 0.97 on average
 *   agreement  every row today's `match_food_card_texts` returns has a
 *              string naming it whose similarity, computed by this code,
 *              equals the database's (within 1e-4); and today's top 10 rows
 *              mostly appear in our top 30 (≥ 0.8 on average, so the check
 *              cannot pass vacuously)
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
  meanDbTop10Found: number;
  maxSimilarityGap: number;
  passed: boolean;
}

const top = (hits: Hit[], n: number) => hits.slice(0, n).map((h) => h.id);

/** Real stored query vectors when the table has them, plus pairs of strings. */
export async function sampleQueries(
  sql: ReadOnlySql,
  texts: Uint16Array
): Promise<number[][]> {
  const [table] = await sql<{ present: boolean }[]>`
    SELECT to_regclass('public.ingredient_query_embeddings') IS NOT NULL AS present`;
  const real = table?.present
    ? (
        await sql<{ e: string }[]>`
          SELECT embedding::text AS e FROM ingredient_query_embeddings
          WHERE embedding IS NOT NULL ORDER BY md5(name_vi) LIMIT 20`
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
  sql: ReadOnlySql,
  input: ParityInput,
  queries: number[][]
): Promise<ParityReport> {
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
    db[Number(r.query_index) - 1]?.push({
      id: r.food_composition_id,
      similarity: Number(r.similarity),
    });
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
    recalls.push(
      truth.size === 0
        ? 1
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
        ? 1
        : dbTop.filter((id) => ourTop.has(id)).length / dbTop.length
    );
  });
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const report = {
    samples: queries.length,
    minRecall: Math.min(...recalls),
    meanRecall: mean(recalls),
    meanDbTop10Found: mean(dbFound),
    maxSimilarityGap: maxGap,
  };
  return {
    ...report,
    passed:
      queries.length > 0 &&
      report.minRecall >= 0.9 &&
      report.meanRecall >= 0.97 &&
      report.meanDbTop10Found >= 0.8 &&
      report.maxSimilarityGap <= 1e-4,
  };
}
