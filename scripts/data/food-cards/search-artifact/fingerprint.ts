/**
 * A cheap summary of everything the artifact is built from, computed in
 * Postgres so only one small row per part comes back (no vector egress):
 *
 *   catalog   md5 of the exact catalog query's rows (`CATALOG_ROWS_SQL`)
 *   links     md5 of every (string, row) pair in food_card_text_rows
 *   texts     the string id range and the unembedded count (index-only), and
 *             md5 of ~128 stored vectors picked by primary key, which catches
 *             a re-embed under unchanged ids
 *
 * Strings are never edited in place (`card-sql.ts` inserts new ones and
 * deletes unused ones), so the id range and the links cover string changes.
 * A re-embed that leaves the sampled vectors unchanged is not guaranteed to
 * be caught: re-embedding requires `--force` (docs/GOOGLE_CLOUD_RUN.md).
 */
import { CATALOG_ROWS_SQL } from '@/lib/ai/matching/cards/catalog-sql';
import type { ReadOnlySql } from './connect';

export interface Fingerprint {
  catalog: string;
  catalogRows: number;
  links: string;
  linkRows: number;
  linkedTexts: number;
  minTextId: number;
  maxTextId: number;
  unembedded: number;
  sampledVectors: string;
}

const SAMPLES = 128;

/** Evenly spaced ids from min to max, deduplicated (fixed index lookups). */
export function sampleIds(min: number, max: number, samples = SAMPLES) {
  if (max < min) return [];
  const span = max - min;
  const ids = new Set<number>();
  for (let k = 0; k < samples; k++) {
    ids.add(min + Math.round((k * span) / Math.max(1, samples - 1)));
  }
  return [...ids];
}

type Tx = Pick<ReadOnlySql, 'unsafe'>;

export async function readFingerprint(tx: Tx): Promise<Fingerprint> {
  const [catalog] = await tx.unsafe<{ md5: string | null; n: string }[]>(
    `SELECT md5(string_agg(to_jsonb(q)::text, E'\\n' ORDER BY q.id)) AS md5,
            count(*) AS n
     FROM (${CATALOG_ROWS_SQL}) q`
  );
  const [links] = await tx.unsafe<
    { md5: string | null; n: string; texts: string }[]
  >(
    `SELECT md5(string_agg(to_jsonb(r)::text, E'\\n'
                ORDER BY r.text_id, r.food_composition_id)) AS md5,
            count(*) AS n,
            count(DISTINCT r.text_id) AS texts
     FROM food_card_text_rows r`
  );
  const [range] = await tx.unsafe<{ min: number | null; max: number | null }[]>(
    'SELECT min(id) AS min, max(id) AS max FROM food_card_texts'
  );
  const [nulls] = await tx.unsafe<{ n: string }[]>(
    'SELECT count(*) AS n FROM food_card_texts WHERE embedding IS NULL'
  );
  const ids = sampleIds(range.min ?? 0, range.max ?? -1);
  const [sampled] = await tx.unsafe<{ md5: string | null }[]>(
    `SELECT md5(string_agg(id::text || ':' || coalesce(encode(halfvec_send(embedding), 'hex'), 'null'),
                ',' ORDER BY id)) AS md5
     FROM food_card_texts WHERE id = ANY($1::int[])`,
    [ids]
  );
  return {
    catalog: catalog.md5 ?? '',
    catalogRows: Number(catalog.n),
    links: links.md5 ?? '',
    linkRows: Number(links.n),
    linkedTexts: Number(links.texts),
    minTextId: range.min ?? 0,
    maxTextId: range.max ?? 0,
    unembedded: Number(nulls.n),
    sampledVectors: sampled.md5 ?? '',
  };
}
