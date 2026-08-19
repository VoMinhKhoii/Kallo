import { describe, expect, it } from 'vitest';
import {
  parseMatchRows,
  parseSourcedMatchRows,
} from '@/lib/ai/matching/match-rows';

/**
 * One row exactly as the `*_match_ingredients_*` functions return it:
 * id text, name_primary text, name_alt text[], name_en text, state text,
 * source_id int, similarity float.
 */
const RAW_ROW = {
  id: 'fao_vn_2007_1013_raw',
  name_primary: 'Bánh phở',
  name_alt: ['Phở tươi'],
  name_en: 'Rice noodles',
  state: 'raw',
  source_id: 1,
  similarity: 0.92,
};

describe('parseSourcedMatchRows', () => {
  it('reads the declared row shape verbatim', () => {
    expect(parseSourcedMatchRows([RAW_ROW])).toEqual([RAW_ROW]);
  });

  it('keeps every row, in order, without re-scoring', () => {
    const rows = [
      { ...RAW_ROW, id: 'a', similarity: 0.4 },
      { ...RAW_ROW, id: 'b', similarity: 0.9 },
      { ...RAW_ROW, id: 'c', similarity: 0.7 },
    ];
    expect(parseSourcedMatchRows(rows).map((r) => r.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(parseSourcedMatchRows(rows).map((r) => r.similarity)).toEqual([
      0.4, 0.9, 0.7,
    ]);
  });

  it('preserves a null name_alt (the column is nullable)', () => {
    const [row] = parseSourcedMatchRows([{ ...RAW_ROW, name_alt: null }]);
    expect(row.name_alt).toBeNull();
  });

  it('normalizes nullable name_en / state to empty strings', () => {
    const [row] = parseSourcedMatchRows([
      { ...RAW_ROW, name_en: null, state: null },
    ]);
    expect(row.name_en).toBe('');
    expect(row.state).toBe('');
  });

  it('returns an empty list for a non-array result set', () => {
    expect(parseSourcedMatchRows(undefined)).toEqual([]);
    expect(parseSourcedMatchRows(null)).toEqual([]);
  });

  it('returns an empty list for an empty result set', () => {
    expect(parseSourcedMatchRows([])).toEqual([]);
  });
});

describe('parseMatchRows', () => {
  it('reads a single-source result set with the same shape', () => {
    const [row] = parseMatchRows([RAW_ROW]);
    expect(row.id).toBe('fao_vn_2007_1013_raw');
    expect(row.name_primary).toBe('Bánh phở');
    expect(row.similarity).toBe(0.92);
  });
});
