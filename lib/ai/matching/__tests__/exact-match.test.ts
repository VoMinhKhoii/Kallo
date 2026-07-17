import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/lib/db';
import { resolveExactMatch } from '../exact-match';

type MockDb = { execute: ReturnType<typeof vi.fn> };

function db(rows: unknown): AppDb {
  return {
    execute: vi.fn().mockResolvedValue(rows),
  } as unknown as AppDb;
}

const ROW = {
  id: 'fao_vn_2007_8051_raw',
  name_primary: 'Tôm biển',
  state: 'raw',
};

afterEach(() => vi.restoreAllMocks());

describe('resolveExactMatch', () => {
  it('returns a high-confidence candidate for a single unambiguous hit', async () => {
    const info = await resolveExactMatch('Tôm biển', db([ROW]), 'unknown');
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
      db([ROW, { ...ROW, id: 'other' }]),
      'unknown'
    );
    expect(info).toBeNull();
  });

  it('returns null on a miss (0 rows)', async () => {
    const info = await resolveExactMatch('nonexistent', db([]), 'unknown');
    expect(info).toBeNull();
  });

  it('returns null (deferring to cascade) on DB error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = {
      execute: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as AppDb;
    const info = await resolveExactMatch('Tôm biển', failing, 'unknown');
    expect(info).toBeNull();
  });

  it('returns null for an empty/whitespace name without querying', async () => {
    const mock = db([ROW]) as unknown as MockDb;
    const info = await resolveExactMatch('   ', mock as unknown as AppDb, 'unknown');
    expect(info).toBeNull();
    expect(mock.execute).not.toHaveBeenCalled();
  });

  it('queries once for a non-empty (NFD) name and still resolves', async () => {
    const mock = db([ROW]) as unknown as MockDb;
    const info = await resolveExactMatch(
      '  Tôm biển  '.normalize('NFD'),
      mock as unknown as AppDb,
      'unknown'
    );
    expect(info?.foodCompositionId).toBe('fao_vn_2007_8051_raw');
    expect(mock.execute).toHaveBeenCalledOnce();
  });
});
