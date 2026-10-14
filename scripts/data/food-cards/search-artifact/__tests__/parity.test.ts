import { describe, expect, it } from 'vitest';
import { buildIndex } from '../artifact-files';
import type { ReadOnlySql } from '../connect';
import { checkParity } from '../parity';
import {
  type CardData,
  cardData,
  matchFoodCardTexts,
} from './card-data-doubles';

const data = cardData(400, 12, 7);

function input(stored: Uint16Array, textRows = data.textRows) {
  const built = buildIndex(stored);
  return {
    store: { texts: stored, norms: built.norms, textRows },
    prefixes: built.prefixes,
    count: built.count,
    index: built.index,
  };
}

/** A database answering with an independent re-implementation of the SQL. */
function database(
  truth: Pick<CardData, 'texts' | 'textRows'>,
  rows?: unknown[]
) {
  return {
    unsafe: async () => rows ?? matchFoodCardTexts(truth, data.queries),
  } as unknown as ReadOnlySql;
}

describe('checkParity', () => {
  it('passes when the artifact holds the database vectors', async () => {
    const report = await checkParity(
      database(data),
      input(data.texts),
      data.queries
    );
    expect(report.passed).toBe(true);
    expect(report.maxSimilarityGap).toBeLessThan(1e-6);
  });

  it('fails when the vectors were decoded with the wrong byte order', async () => {
    const swapped = data.texts.map((h) => ((h & 0xff) << 8) | (h >> 8));
    const report = await checkParity(
      database(data),
      input(swapped),
      data.queries
    );
    expect(report.passed).toBe(false);
  });

  it('fails when the database knows a row the artifact lacks', async () => {
    const report = await checkParity(
      database(data),
      input(
        data.texts,
        data.textRows.map(() => [])
      ),
      data.queries
    );
    expect(report.passed).toBe(false);
    expect(report.maxSimilarityGap).toBe(1);
  });

  it('fails when the database returns nothing', async () => {
    const report = await checkParity(
      database(data, []),
      input(data.texts),
      data.queries
    );
    expect(report.passed).toBe(false);
  });

  it('fails when the database answers only some samples', async () => {
    const some = matchFoodCardTexts(data, data.queries).filter(
      (r) => r.query_index <= 6
    );
    const report = await checkParity(
      database(data, some),
      input(data.texts),
      data.queries
    );
    expect(report.passed).toBe(false);
  });

  it('refuses malformed database rows', async () => {
    await expect(
      checkParity(
        database(data, [
          { query_index: 99, food_composition_id: 'r', similarity: 0.5 },
        ]),
        input(data.texts),
        data.queries
      )
    ).rejects.toThrow(/query_index 99/);
    await expect(
      checkParity(
        database(data, [
          { query_index: 1, food_composition_id: 'r', similarity: 'NaN' },
        ]),
        input(data.texts),
        data.queries
      )
    ).rejects.toThrow(/similarity NaN/);
  });

  it('fails with no samples, without asking the database', async () => {
    const report = await checkParity(
      {
        unsafe: async () => {
          throw new Error('should not query');
        },
      } as unknown as ReadOnlySql,
      input(data.texts),
      []
    );
    expect(report.passed).toBe(false);
  });
});
