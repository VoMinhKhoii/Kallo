/**
 * Test doubles for the artifact builder: synthetic card data, a database that
 * answers only inside READ ONLY transactions (with an independent
 * re-implementation of `match_food_card_texts`), and an in-memory bucket with
 * GCS's generation preconditions.
 */
import { createHash } from 'node:crypto';
import { vi } from 'vitest';
import {
  DIMS,
  floatToHalf,
  halfToFloat,
  PREFIX_DIMS,
} from '@/lib/ai/matching/cards/search-index/search-core.mjs';
import type { ReadOnlySql } from '../connect';
import type { Storage } from '../publish';

export function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export interface CardData {
  texts: Uint16Array;
  textRows: string[][];
  queries: number[][];
}

export function cardData(
  count: number,
  queryCount: number,
  seed = 11
): CardData {
  const next = rng(seed);
  const texts = new Uint16Array(count * DIMS);
  for (let k = 0; k < texts.length; k++) texts[k] = floatToHalf(next() * 2 - 1);
  const textRows = Array.from({ length: count }, (_, i) =>
    i % 7 === 0 ? [`row_${i}`, `row_shared_${i % 3}`] : [`row_${i}`]
  );
  const queries = Array.from({ length: queryCount }, () =>
    Array.from({ length: DIMS }, () => next() * 2 - 1)
  );
  return { texts, textRows, queries };
}

/**
 * `match_food_card_texts` from its SQL definition, written independently of
 * search-core: top `perQuery` strings by the cosine of the 256-dim prefixes,
 * rescored with all 768 dims (query cast to half precision), max per row.
 */
export function matchFoodCardTexts(
  data: Pick<CardData, 'texts' | 'textRows'>,
  queries: number[][],
  perQuery = 100
) {
  const count = data.texts.length / DIMS;
  const stored = (i: number, j: number) =>
    halfToFloat(data.texts[i * DIMS + j]);
  const cosine = (q: number[], i: number, dims: number) => {
    let dot = 0;
    let a = 0;
    let b = 0;
    for (let j = 0; j < dims; j++) {
      dot += stored(i, j) * q[j];
      a += stored(i, j) ** 2;
      b += q[j] ** 2;
    }
    return dot / Math.sqrt(a * b);
  };
  const rows: {
    query_index: number;
    food_composition_id: string;
    similarity: number;
  }[] = [];
  queries.forEach((raw, n) => {
    const q = raw.map((x) => halfToFloat(floatToHalf(x)));
    const nearest = Array.from({ length: count }, (_, i) => i)
      .map((i) => ({ i, d: cosine(q, i, PREFIX_DIMS) }))
      .sort((x, y) => y.d - x.d)
      .slice(0, perQuery);
    const best = new Map<string, number>();
    for (const { i } of nearest) {
      const sim = cosine(q, i, DIMS);
      for (const id of data.textRows[i]) {
        best.set(id, Math.max(best.get(id) ?? -2, sim));
      }
    }
    for (const [id, similarity] of best) {
      rows.push({ query_index: n + 1, food_composition_id: id, similarity });
    }
  });
  return rows;
}

/** halfvec_send bytes for one stored string. */
function halfvecSend(data: CardData, i: number): Uint8Array {
  const bytes = new Uint8Array(4 + 2 * DIMS);
  const view = new DataView(bytes.buffer);
  view.setInt16(0, DIMS);
  for (let j = 0; j < DIMS; j++)
    view.setUint16(4 + 2 * j, data.texts[i * DIMS + j]);
  return bytes;
}

/**
 * A database holding `data` that refuses any query outside a transaction and
 * records each transaction's mode. `dbAnswers` overrides the vector search.
 */
export function fakeDatabase(
  data: CardData,
  opts: {
    dbAnswers?: (queries: number[][]) => unknown[];
    unembedded?: number;
  } = {}
) {
  const modes: string[] = [];
  const count = data.texts.length / DIMS;
  const links = data.textRows.flatMap((rows, i) =>
    rows.map((id) => ({ text_id: i + 1, food_composition_id: id }))
  );
  const unsafe = vi.fn(async (query: string, params?: unknown[]) => {
    if (query.includes("E'\\n' ORDER BY q.id"))
      return [{ md5: 'catalog-md5', n: '1' }];
    if (query.includes('count(DISTINCT r.text_id)'))
      return [
        { md5: 'links-md5', n: String(links.length), texts: String(count) },
      ];
    if (query.includes('min(id)')) return [{ min: 1, max: count }];
    if (query.includes('FROM food_card_texts WHERE embedding IS NULL'))
      return [{ n: String(opts.unembedded ?? 0) }];
    if (query.includes('id = ANY')) return [{ md5: 'sampled-md5' }];
    if (query.includes('halfvec_send(t.embedding)'))
      return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        b: halfvecSend(data, i),
      }));
    if (query.includes('FROM food_card_text_rows')) return links;
    if (query.includes('to_regclass')) return [{ present: true }];
    if (query.includes('FROM ingredient_query_embeddings'))
      return data.queries.map((q) => ({ e: JSON.stringify(q) }));
    if (query.includes('match_food_card_texts')) {
      const literal = String(params?.[0]);
      const queries = JSON.parse(
        `[${literal.slice(1, -1).replaceAll('"[', '[').replaceAll(']"', ']')}]`
      ) as number[][];
      return opts.dbAnswers
        ? opts.dbAnswers(queries)
        : matchFoodCardTexts(data, queries);
    }
    if (query.includes('FROM vietnamese_food_composition v'))
      return [
        {
          id: 'row_0',
          source_code: 'USDA_SR',
          state: 'raw',
          name_en: 'Beef',
          name_primary: 'Bò',
          food: 'beef',
          aliases_en: null,
          names_vi: null,
          part_cut: null,
          form_processing: null,
          cooking_method: null,
          fat_level: null,
          brand: null,
        },
      ];
    throw new Error(`unexpected query: ${query.slice(0, 80)}`);
  });
  const sql = {
    unsafe: () => {
      throw new Error('query outside a transaction');
    },
    begin: vi.fn(async (mode: string, fn: (tx: unknown) => unknown) => {
      modes.push(mode);
      return fn({ unsafe });
    }),
  } as unknown as ReadOnlySql;
  return { sql, modes, unsafe };
}

interface StoredObject {
  body: Buffer;
  generation: number;
}

/** A bucket with GCS's create-if-absent / replace-this-generation rules. */
export function memoryBucket() {
  const objects = new Map<string, StoredObject>();
  let nextGeneration = 1000;
  const writes: string[] = [];
  const put = (name: string, body: Uint8Array) => {
    objects.set(name, {
      body: Buffer.from(body),
      generation: nextGeneration++,
    });
  };
  const storage: Storage = {
    download: async (_bucket, name) => {
      const found = objects.get(name);
      return found
        ? { body: found.body, generation: String(found.generation) }
        : null;
    },
    upload: async (_bucket, name, body, ifGenerationMatch) => {
      const current = objects.get(name);
      const matches =
        ifGenerationMatch === '0'
          ? !current
          : current?.generation === Number(ifGenerationMatch);
      if (!matches) return false;
      put(name, body);
      writes.push(name);
      return true;
    },
    createImmutable: async (_bucket, name, body) => {
      const current = objects.get(name);
      if (current) {
        const same =
          createHash('md5').update(body).digest('hex') ===
          createHash('md5').update(current.body).digest('hex');
        if (!same) throw new Error(`${name} exists with other contents`);
        return;
      }
      put(name, body);
      writes.push(name);
    },
  };
  return { storage, objects, writes, put };
}
