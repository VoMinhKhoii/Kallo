import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb } from '@/lib/infra/db/__fixtures__/fake-db';
import { resolveExactMatch } from '../exact-match';

/** A double whose single `execute` resolves to `rows`. */
function db(rows: unknown[]) {
  const fake = createFakeDb();
  fake.queueExecute(rows);
  return fake;
}

const ROW = {
  id: 'fao_vn_2007_8051_raw',
  name_primary: 'Tôm biển',
  state: 'raw',
};

afterEach(() => vi.restoreAllMocks());

describe('resolveExactMatch', () => {
  it('returns a high-confidence candidate for a single unambiguous hit', async () => {
    const info = await resolveExactMatch('Tôm biển', db([ROW]).db, 'unknown');
    expect(info).not.toBeNull();
    expect(info?.foodCompositionId).toBe('fao_vn_2007_8051_raw');
    expect(info?.matchedName).toBe('Tôm biển');
    expect(info?.similarity).toBe(1);
    expect(info?.confidence).toBe('high');
    expect(info?.state).toBe('raw');
  });

  it('returns null when the lookup is ambiguous (2+ rows)', async () => {
    const info = await resolveExactMatch(
      'onion',
      db([ROW, { ...ROW, id: 'other' }]).db,
      'unknown'
    );
    expect(info).toBeNull();
  });

  it('returns null on a miss (0 rows)', async () => {
    const info = await resolveExactMatch('nonexistent', db([]).db, 'unknown');
    expect(info).toBeNull();
  });

  it('returns null (deferring to cascade) on DB error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = createFakeDb();
    failing.execute.mockRejectedValueOnce(new Error('boom'));
    const info = await resolveExactMatch('Tôm biển', failing.db, 'unknown');
    expect(info).toBeNull();
  });

  it('returns null for an empty/whitespace name without querying', async () => {
    const fake = db([ROW]);
    const info = await resolveExactMatch('   ', fake.db, 'unknown');
    expect(info).toBeNull();
    expect(fake.execute).not.toHaveBeenCalled();
  });

  it('queries once for a non-empty (NFD) name and still resolves', async () => {
    const fake = db([ROW]);
    const info = await resolveExactMatch(
      '  Tôm biển  '.normalize('NFD'),
      fake.db,
      'unknown'
    );
    expect(info?.foodCompositionId).toBe('fao_vn_2007_8051_raw');
    expect(fake.execute).toHaveBeenCalledOnce();
  });
});
