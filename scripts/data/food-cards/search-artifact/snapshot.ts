/**
 * Everything the artifact holds, read in one REPEATABLE READ, READ ONLY
 * transaction, so the catalog, the strings, their vectors and their links all
 * come from one database state, and the fingerprint read in the same
 * transaction describes exactly that state.
 */
import {
  CATALOG_ROWS_SQL,
  type CatalogQueryRow,
} from '@/lib/ai/matching/cards/catalog-sql';
import {
  DIMS,
  decodeHalfvecSend,
} from '@/lib/ai/matching/cards/search-index/search-core.mjs';
import type { ReadOnlySql } from './connect';
import { type Fingerprint, readFingerprint } from './fingerprint';

export interface Snapshot {
  fingerprint: Fingerprint;
  catalogRows: CatalogQueryRow[];
  /** Linked strings in id order: count × DIMS half bit patterns. */
  texts: Uint16Array;
  textIds: number[];
  /** For each string (same order), the food rows it names. */
  textRows: string[][];
}

export class NotReadyError extends Error {}

export async function readSnapshot(sql: ReadOnlySql): Promise<Snapshot> {
  return sql.begin('isolation level repeatable read read only', async (tx) => {
    const fingerprint = await readFingerprint(tx);
    if (fingerprint.unembedded > 0 || fingerprint.linkRows === 0) {
      throw new NotReadyError(
        `card strings not ready: ${fingerprint.unembedded} unembedded, ${fingerprint.linkRows} links`
      );
    }
    // Ordered, so the same data always writes the same catalog.json bytes.
    const catalogRows = await tx.unsafe<CatalogQueryRow[]>(
      `${CATALOG_ROWS_SQL}\nORDER BY v.id`
    );
    // Only strings that name a row: an orphan could never be returned, and
    // the runtime self-test picks strings that must map to rows.
    const vectorRows = await tx.unsafe<{ id: number; b: Uint8Array }[]>(
      `SELECT t.id, halfvec_send(t.embedding) AS b
       FROM food_card_texts t
       WHERE EXISTS (SELECT 1 FROM food_card_text_rows r WHERE r.text_id = t.id)
       ORDER BY t.id`
    );
    const links = await tx.unsafe<
      { text_id: number; food_composition_id: string }[]
    >(
      `SELECT text_id, food_composition_id FROM food_card_text_rows
       ORDER BY text_id, food_composition_id`
    );

    const texts = new Uint16Array(vectorRows.length * DIMS);
    const textIds: number[] = [];
    const position = new Map<number, number>();
    vectorRows.forEach((row, i) => {
      texts.set(decodeHalfvecSend(row.b), i * DIMS);
      textIds.push(row.id);
      position.set(row.id, i);
    });
    const textRows: string[][] = textIds.map(() => []);
    for (const link of links) {
      const i = position.get(link.text_id);
      if (i === undefined) {
        throw new Error(`link to unknown string ${link.text_id}`);
      }
      textRows[i].push(link.food_composition_id);
    }
    if (textRows.some((rows) => rows.length === 0)) {
      throw new Error('a string with no rows slipped into the snapshot');
    }
    if (textIds.length !== fingerprint.linkedTexts) {
      throw new Error(
        `expected ${fingerprint.linkedTexts} linked strings, read ${textIds.length}`
      );
    }
    return { fingerprint, catalogRows, texts, textIds, textRows };
  });
}
