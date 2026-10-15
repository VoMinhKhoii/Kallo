import { describe, expect, it, vi } from 'vitest';
import { encodePassword } from '../connect';
import { readFingerprint, sampleIds } from '../fingerprint';

describe('sampleIds', () => {
  it('spreads ids evenly from min to max, endpoints included', () => {
    const ids = sampleIds(1, 61_476);
    expect(ids).toHaveLength(128);
    expect(ids[0]).toBe(1);
    expect(ids.at(-1)).toBe(61_476);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
  });

  it('deduplicates small ranges and handles an empty table', () => {
    expect(sampleIds(5, 7)).toEqual([5, 6, 7]);
    expect(sampleIds(0, -1)).toEqual([]);
  });
});

describe('readFingerprint', () => {
  it('serialises rows as JSON in key order, never by concatenation', async () => {
    const unsafe = vi.fn(async (query: string) => {
      if (query.includes('min(id)')) return [{ min: 1, max: 9 }];
      return [{ md5: 'x', n: '3', texts: '2' }];
    });
    const fp = await readFingerprint({ unsafe } as never);
    const queries = unsafe.mock.calls.map(([q]) => q as string);

    expect(queries[0]).toMatch(/to_jsonb\(q\)::text, E'\\n' ORDER BY q\.id/);
    expect(queries[1]).toMatch(
      /to_jsonb\(r\)::text, E'\\n'\s+ORDER BY r\.text_id, r\.food_composition_id/
    );
    expect(queries.some((q) => q.includes('id = ANY($1::int[])'))).toBe(true);
    expect(fp).toMatchObject({ minTextId: 1, maxTextId: 9, catalogRows: 3 });
  });
});

describe('encodePassword', () => {
  it('percent-encodes only the password, like encodeDbUrl', () => {
    expect(encodePassword('postgresql://user:p/ss#w%rd@host:5432/db')).toBe(
      'postgresql://user:p%2Fss%23w%25rd@host:5432/db'
    );
    expect(encodePassword('not a url')).toBe('not a url');
  });
});
