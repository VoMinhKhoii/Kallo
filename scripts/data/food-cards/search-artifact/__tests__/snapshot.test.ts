import { describe, expect, it, vi } from 'vitest';
import { DIMS } from '@/lib/ai/matching/cards/search-index/search-core.mjs';
import type { ReadOnlySql } from '../connect';
import { NotReadyError, readSnapshot } from '../snapshot';

/** `halfvec_send` bytes: big-endian dims, unused int16, big-endian halves. */
function halfvecSend(first: number): Uint8Array {
  const bytes = new Uint8Array(4 + 2 * DIMS);
  const view = new DataView(bytes.buffer);
  view.setInt16(0, DIMS);
  view.setUint16(4, first);
  return bytes;
}

function fakeSql(opts: {
  unembedded?: number;
  links: { text_id: number; food_composition_id: string }[];
  vectors: { id: number; b: Uint8Array }[];
  linkedTexts?: number;
}) {
  const unsafe = vi.fn(async (query: string) => {
    if (query.includes("E'\\n' ORDER BY q.id")) return [{ md5: 'c', n: '1' }];
    if (query.includes('count(DISTINCT r.text_id)'))
      return [
        {
          md5: 'l',
          n: String(opts.links.length),
          texts: String(opts.linkedTexts ?? opts.vectors.length),
        },
      ];
    if (query.includes('min(id)')) return [{ min: 1, max: 2 }];
    if (query.includes('embedding IS NULL'))
      return [{ n: String(opts.unembedded ?? 0) }];
    if (query.includes('id = ANY')) return [{ md5: 's' }];
    if (query.includes('halfvec_send(t.embedding)')) return opts.vectors;
    if (query.includes('FROM food_card_text_rows')) return opts.links;
    return [{ id: 'row_a', source_code: 'USDA_SR' }]; // the catalog query
  });
  const begin = vi.fn(async (_mode: string, fn: (tx: unknown) => unknown) =>
    fn({ unsafe })
  );
  return { sql: { begin } as unknown as ReadOnlySql, begin, unsafe };
}

describe('readSnapshot', () => {
  it('reads one repeatable-read snapshot and orders strings with their rows', async () => {
    const { sql, begin } = fakeSql({
      vectors: [
        { id: 1, b: halfvecSend(0x3c00) },
        { id: 2, b: halfvecSend(0xc000) },
      ],
      links: [
        { text_id: 1, food_composition_id: 'row_a' },
        { text_id: 2, food_composition_id: 'row_a' },
        { text_id: 2, food_composition_id: 'row_b' },
      ],
    });

    const snap = await readSnapshot(sql);

    expect(begin.mock.calls[0][0]).toBe(
      'isolation level repeatable read read only'
    );
    expect(snap.textIds).toEqual([1, 2]);
    expect(snap.textRows).toEqual([['row_a'], ['row_a', 'row_b']]);
    expect(snap.texts[0]).toBe(0x3c00);
    expect(snap.texts[DIMS]).toBe(0xc000);
    expect(snap.catalogRows).toHaveLength(1);
  });

  it('refuses while strings are still unembedded', async () => {
    const { sql } = fakeSql({ unembedded: 3, vectors: [], links: [] });
    await expect(readSnapshot(sql)).rejects.toBeInstanceOf(NotReadyError);
  });

  it('refuses a link to a string it did not read', async () => {
    const { sql } = fakeSql({
      vectors: [{ id: 1, b: halfvecSend(0x3c00) }],
      links: [
        { text_id: 1, food_composition_id: 'row_a' },
        { text_id: 9, food_composition_id: 'row_b' },
      ],
    });
    await expect(readSnapshot(sql)).rejects.toThrow(/unknown string 9/);
  });

  it('refuses a string with no rows', async () => {
    const { sql } = fakeSql({
      vectors: [
        { id: 1, b: halfvecSend(0x3c00) },
        { id: 2, b: halfvecSend(0x3c00) },
      ],
      links: [{ text_id: 1, food_composition_id: 'row_a' }],
    });
    await expect(readSnapshot(sql)).rejects.toThrow(/no rows/);
  });
});
