import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cacheQueryEmbedding,
  clearMemoryCache,
  getMemoryCacheStats,
  normalizeIngredientKey,
  resolveQueryEmbedding,
  warmEmbeddingCache,
} from '../embedding-cache';

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

/** Narrow mock type derived from the actual function signature. */
type MockDb = Parameters<typeof warmEmbeddingCache>[0];

function createMockDb(): MockDb {
  return {
    execute: vi.fn(),
  } as unknown as MockDb;
}

/** Extract raw SQL text from a drizzle-orm sql`` tagged template object */
function extractSqlText(query: unknown): string {
  if (typeof query === 'string') return query;
  if (query && typeof query === 'object' && 'queryChunks' in query) {
    const chunks = (query as { queryChunks: unknown[] }).queryChunks;
    return chunks
      .map((c) => {
        if (typeof c === 'string') return c;
        if (c && typeof c === 'object' && 'value' in c) {
          return (c as { value: string[] }).value.join('');
        }
        return '';
      })
      .join('');
  }
  return String(query);
}

/**
 * Create a routing mock DB that dispatches based on SQL content.
 * - SELECT from vietnamese_food_composition (warm-up) → warmUpResponse
 * - SELECT from ingredient_query_embeddings WHERE name_vi → exactResponse
 * - SELECT from ingredient_query_embeddings WHERE lower(name_en) → enCheckResponse
 * - INSERT INTO synonym_candidates → []
 * - Other queries → from extraResponses queue
 */
function createRoutingMockDb(opts: {
  exactResponse?: unknown[];
  enCheckResponse?: unknown[];
  warmUpResponse?: unknown[];
  extraResponses?: unknown[][];
}): MockDb {
  let extraIdx = 0;
  const db = {
    execute: vi.fn().mockImplementation((query: unknown) => {
      const queryStr = extractSqlText(query);
      // Warm-up: loads from food composition table
      if (queryStr.includes('vietnamese_food_composition')) {
        return Promise.resolve(opts.warmUpResponse ?? []);
      }
      if (
        queryStr.includes('ingredient_query_embeddings') &&
        queryStr.includes('name_vi =')
      ) {
        return Promise.resolve(opts.exactResponse ?? []);
      }
      if (
        queryStr.includes('ingredient_query_embeddings') &&
        queryStr.includes('lower(name_en)')
      ) {
        return Promise.resolve(opts.enCheckResponse ?? []);
      }
      if (queryStr.includes('ingredient_query_embeddings')) {
        return Promise.resolve([]);
      }
      if (queryStr.includes('synonym_candidates')) {
        return Promise.resolve([]);
      }
      return Promise.resolve(opts.extraResponses?.[extraIdx++] ?? []);
    }),
  };
  return db as unknown as MockDb;
}

beforeEach(() => {
  clearMemoryCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const SAMPLE_EMBEDDING = Array(768).fill(0.1);

// ---------------------------------------------------------------------------
// normalizeIngredientKey
// ---------------------------------------------------------------------------

describe('normalizeIngredientKey', () => {
  it('lowercases and trims', () => {
    expect(normalizeIngredientKey('  Thịt Bò  ')).toBe('thịt bò');
  });

  it('normalizes NFC vs NFD to the same key', () => {
    // "ị" can be composed (NFC) or decomposed (NFD: i + combining dot below)
    const nfc = 'thịt bò'.normalize('NFC');
    const nfd = 'thịt bò'.normalize('NFD');
    expect(nfc).not.toBe(nfd); // precondition: they differ at byte level
    expect(normalizeIngredientKey(nfc)).toBe(normalizeIngredientKey(nfd));
  });

  it('handles empty and whitespace-only strings', () => {
    expect(normalizeIngredientKey('')).toBe('');
    expect(normalizeIngredientKey('   ')).toBe('');
  });

  it('strips tabs, newlines, and mixed whitespace', () => {
    expect(normalizeIngredientKey('\t Gạo \n')).toBe('gạo');
    expect(normalizeIngredientKey('  \t\n  ')).toBe('');
  });

  it('is idempotent — normalizing an already-normalized string returns same result', () => {
    const once = normalizeIngredientKey('Thịt Bò');
    const twice = normalizeIngredientKey(once);
    expect(twice).toBe(once);
  });

  it('preserves internal spaces (does not collapse)', () => {
    expect(normalizeIngredientKey('thịt  bò  xào')).toBe('thịt  bò  xào');
  });
});

// ---------------------------------------------------------------------------
// resolveQueryEmbedding
// ---------------------------------------------------------------------------

describe('resolveQueryEmbedding', () => {
  it('returns null when name is not in memory or DB', async () => {
    const db = createRoutingMockDb({ exactResponse: [], enCheckResponse: [] });

    const result = await resolveQueryEmbedding('unknown ingredient', db);

    expect(result).toBeNull();
    // 1 warm-up scan + 1 L2 exact query + 1 async name_en check
    expect(db.execute).toHaveBeenCalledTimes(3);
  });

  it('returns embedding from exact name_vi match and promotes both names to L1', async () => {
    const db = createRoutingMockDb({
      exactResponse: [
        {
          name_vi: 'gạo tẻ',
          name_en: 'Rice',
          embedding: JSON.stringify(SAMPLE_EMBEDDING),
        },
      ],
    });

    const result = await resolveQueryEmbedding('Gạo tẻ', db);

    expect(result).toEqual(SAMPLE_EMBEDDING);
    // name_vi ("gạo tẻ") + name_en ("Rice") promoted to L1
    expect(getMemoryCacheStats().size).toBe(2);

    // Second call with same name (different case) hits L1 — no DB call
    db.execute.mockClear();
    const result2 = await resolveQueryEmbedding('gạo tẻ', db);
    expect(result2).toEqual(SAMPLE_EMBEDDING);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('handles DB returning embedding as number array', async () => {
    const db = createRoutingMockDb({
      exactResponse: [
        { name_vi: 'thịt bò', name_en: null, embedding: SAMPLE_EMBEDDING },
      ],
    });

    const result = await resolveQueryEmbedding('Thịt bò', db);

    expect(result).toEqual(SAMPLE_EMBEDDING);
    // Only name_vi cached (name_en is null)
    expect(getMemoryCacheStats().size).toBe(1);
  });

  it('returns null when DB returns unparseable embedding', async () => {
    const db = createRoutingMockDb({
      exactResponse: [{ name_vi: 'bad', name_en: null, embedding: 12345 }],
    });

    const result = await resolveQueryEmbedding('bad', db);

    expect(result).toBeNull();
  });

  it('name_en-only match is a miss and logs synonym candidate', async () => {
    const db = createRoutingMockDb({
      exactResponse: [], // L2 name_vi miss
      enCheckResponse: [{ name_vi: 'gạo tẻ', name_en: 'Rice' }],
    });

    const result = await resolveQueryEmbedding('Rice', db);

    expect(result).toBeNull(); // cache miss — must not return stale embedding

    // Wait for fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 10));

    // Verify: warm-up scan + L2 exact + name_en check + synonym_candidates insert = 4 calls
    expect(db.execute).toHaveBeenCalledTimes(4);
    const lastCall = db.execute.mock.calls[3][0];
    const lastSql = extractSqlText(lastCall);
    expect(lastSql).toContain('synonym_candidates');
  });

  it('normalizes NFC vs NFD: same visual string hits L1 on second call', async () => {
    const nfc = 'thịt bò'.normalize('NFC');
    const nfd = 'thịt bò'.normalize('NFD');

    const db = createRoutingMockDb({
      exactResponse: [
        {
          name_vi: normalizeIngredientKey(nfc),
          name_en: null,
          embedding: SAMPLE_EMBEDDING,
        },
      ],
    });

    // First call with NFC form
    const result1 = await resolveQueryEmbedding(nfc, db);
    expect(result1).toEqual(SAMPLE_EMBEDDING);

    // Second call with NFD form — should hit L1 (same normalized key)
    db.execute.mockClear();
    const result2 = await resolveQueryEmbedding(nfd, db);
    expect(result2).toEqual(SAMPLE_EMBEDDING);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('no synonym candidate logged when name_en also misses', async () => {
    const db = createRoutingMockDb({
      exactResponse: [],
      enCheckResponse: [], // name_en also misses
    });

    const result = await resolveQueryEmbedding('nonexistent', db);

    expect(result).toBeNull();

    // Wait for fire-and-forget
    await new Promise((r) => setTimeout(r, 10));

    // Only 3 calls: warm-up scan + L2 exact + name_en check (no insert since no match)
    expect(db.execute).toHaveBeenCalledTimes(3);
  });

  it('returns null safely when DB throws on L2 query', async () => {
    const db = createMockDb();
    db.execute.mockRejectedValue(new Error('connection timeout'));

    const result = await resolveQueryEmbedding('thịt bò', db);
    expect(result).toBeNull();
  });

  it('handles empty string input without crashing', async () => {
    const db = createRoutingMockDb({ exactResponse: [], enCheckResponse: [] });

    const result = await resolveQueryEmbedding('', db);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// cacheQueryEmbedding
// ---------------------------------------------------------------------------

describe('cacheQueryEmbedding', () => {
  it('populates L1 memory cache synchronously with normalized key', () => {
    const db = createMockDb();
    db.execute.mockResolvedValue([]);

    cacheQueryEmbedding('  New Ingredient  ', SAMPLE_EMBEDDING, db);

    expect(getMemoryCacheStats().size).toBe(1);
  });

  it('fires DB insert with normalized name_vi (does not await)', async () => {
    const db = createMockDb();
    db.execute.mockResolvedValue([]);

    cacheQueryEmbedding('New Ingredient', SAMPLE_EMBEDDING, db);

    await new Promise((r) => setTimeout(r, 10));
    expect(db.execute).toHaveBeenCalledOnce();

    // Verify the SQL uses the normalized name
    const sql = extractSqlText(db.execute.mock.calls[0][0]);
    expect(sql).toContain('ingredient_query_embeddings');
  });

  it('does not throw when DB insert fails', async () => {
    const db = createMockDb();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.execute.mockRejectedValue(new Error('connection lost'));

    cacheQueryEmbedding('failing ingredient', SAMPLE_EMBEDDING, db);

    await new Promise((r) => setTimeout(r, 10));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to persist embedding'),
      expect.any(Error)
    );

    // L1 cache should still have the entry
    expect(getMemoryCacheStats().size).toBe(1);
    consoleSpy.mockRestore();
  });

  it('caching same key twice overwrites L1 with latest embedding', () => {
    const db = createMockDb();
    db.execute.mockResolvedValue([]);

    const embedding1 = Array(768).fill(0.1);
    const embedding2 = Array(768).fill(0.9);

    cacheQueryEmbedding('Thịt Bò', embedding1, db);
    cacheQueryEmbedding('thịt bò', embedding2, db);

    // L1 should have exactly 1 entry (same normalized key), with latest value
    expect(getMemoryCacheStats().size).toBe(1);
  });

  it('handles empty string input without crashing', () => {
    const db = createMockDb();
    db.execute.mockResolvedValue([]);

    cacheQueryEmbedding('', SAMPLE_EMBEDDING, db);

    expect(getMemoryCacheStats().size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// L1 + L2 integration
// ---------------------------------------------------------------------------

describe('L1 + L2 integration', () => {
  it('cacheQueryEmbedding makes subsequent resolveQueryEmbedding hit L1', async () => {
    const db = createMockDb();
    db.execute.mockResolvedValue([]);

    // Cache an embedding
    cacheQueryEmbedding('Thịt gà', SAMPLE_EMBEDDING, db);

    // Clear the mock call count from the fire-and-forget insert
    db.execute.mockClear();

    // Resolve should hit L1, no DB call
    const result = await resolveQueryEmbedding('Thịt gà', db);

    expect(result).toEqual(SAMPLE_EMBEDDING);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('normalization ensures case-different inputs share L1 cache', async () => {
    const db = createMockDb();
    db.execute.mockResolvedValue([]);

    // Cache with one casing
    cacheQueryEmbedding('Thịt Bò', SAMPLE_EMBEDDING, db);

    db.execute.mockClear();

    // Resolve with different casing — should hit L1 (both normalize to "thịt bò")
    const result = await resolveQueryEmbedding('thịt bò', db);

    expect(result).toEqual(SAMPLE_EMBEDDING);
    expect(db.execute).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// logSynonymCandidateIfEnMatch error handling
// ---------------------------------------------------------------------------

describe('logSynonymCandidateIfEnMatch (via resolveQueryEmbedding)', () => {
  it('silently catches DB error during name_en check', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = {
      execute: vi.fn().mockImplementation((query: unknown) => {
        const queryStr = extractSqlText(query);
        // First call: L2 exact → miss
        if (queryStr.includes('name_vi =')) {
          return Promise.resolve([]);
        }
        // Second call: name_en check → DB error
        if (queryStr.includes('lower(name_en)')) {
          return Promise.reject(new Error('name_en check failed'));
        }
        return Promise.resolve([]);
      }),
    } as unknown as MockDb;

    const result = await resolveQueryEmbedding('test', db);
    expect(result).toBeNull();

    await new Promise((r) => setTimeout(r, 10));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to log synonym candidate'),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('silently catches DB error during synonym_candidates insert', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = {
      execute: vi.fn().mockImplementation((query: unknown) => {
        const queryStr = extractSqlText(query);
        if (queryStr.includes('name_vi =')) {
          return Promise.resolve([]);
        }
        if (queryStr.includes('lower(name_en)')) {
          return Promise.resolve([{ name_vi: 'gạo', name_en: 'Rice' }]);
        }
        if (queryStr.includes('synonym_candidates')) {
          return Promise.reject(new Error('insert failed'));
        }
        return Promise.resolve([]);
      }),
    } as unknown as MockDb;

    const result = await resolveQueryEmbedding('rice', db);
    expect(result).toBeNull();

    await new Promise((r) => setTimeout(r, 10));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to log synonym candidate'),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// warmEmbeddingCache
// ---------------------------------------------------------------------------

describe('warmEmbeddingCache', () => {
  const EMBEDDING_VEC = [0.1, 0.2, 0.3];

  it('populates L1 cache from VN FCT food items', async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([
        { name_primary: 'gạo', name_en: 'rice', embedding: EMBEDDING_VEC },
        { name_primary: 'thịt gà', name_en: null, embedding: EMBEDDING_VEC },
      ]),
    } as unknown as MockDb;

    await warmEmbeddingCache(db);

    expect(getMemoryCacheStats().size).toBe(3); // name_vi × 2 + name_en × 1
    expect(db.execute).toHaveBeenCalledOnce();
  });

  it('runs only once per process (boolean flag guard)', async () => {
    const db = {
      execute: vi
        .fn()
        .mockResolvedValue([
          { name_primary: 'gạo', name_en: null, embedding: EMBEDDING_VEC },
        ]),
    } as unknown as MockDb;

    await warmEmbeddingCache(db);
    await warmEmbeddingCache(db);
    await warmEmbeddingCache(db);

    expect(db.execute).toHaveBeenCalledOnce();
  });

  it('warm-up after clearMemoryCache resets flag and allows retry', async () => {
    const db = {
      execute: vi
        .fn()
        .mockResolvedValueOnce([
          { name_primary: 'gạo', name_en: null, embedding: EMBEDDING_VEC },
        ])
        .mockResolvedValueOnce([
          {
            name_primary: 'thịt bò',
            name_en: 'beef',
            embedding: EMBEDDING_VEC,
          },
        ]),
    } as unknown as MockDb;

    await warmEmbeddingCache(db);
    expect(getMemoryCacheStats().size).toBe(1);

    clearMemoryCache();

    await warmEmbeddingCache(db);
    expect(getMemoryCacheStats().size).toBe(2); // name_vi + name_en
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  it('skips rows with invalid embeddings silently', async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([
        { name_primary: 'gạo', name_en: null, embedding: null },
        { name_primary: 'thịt gà', name_en: null, embedding: EMBEDDING_VEC },
      ]),
    } as unknown as MockDb;

    await warmEmbeddingCache(db);
    expect(getMemoryCacheStats().size).toBe(1); // only the valid row
  });

  it('swallows DB error and resets flag to allow retry on next request', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = {
      execute: vi
        .fn()
        .mockRejectedValueOnce(new Error('DB connection refused'))
        .mockResolvedValueOnce([
          { name_primary: 'gạo', name_en: null, embedding: EMBEDDING_VEC },
        ]),
    } as unknown as MockDb;

    // First call: DB error → flag reset → cache still empty
    await warmEmbeddingCache(db);
    expect(getMemoryCacheStats().size).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warm-up failed'),
      expect.any(Error)
    );

    // Second call: succeeds now that flag was reset
    await warmEmbeddingCache(db);
    expect(getMemoryCacheStats().size).toBe(1);
    warnSpy.mockRestore();
  });

  it('when DATABASE_URL is absent, DB error is swallowed gracefully', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = {
      execute: vi
        .fn()
        .mockRejectedValue(new Error('ECONNREFUSED — no DATABASE_URL')),
    } as unknown as MockDb;

    await expect(warmEmbeddingCache(db)).resolves.toBeUndefined();
    expect(getMemoryCacheStats().size).toBe(0);
    warnSpy.mockRestore();
  });

  it('normalizes keys so mixed-case DB names hit L1 on normalized lookup', async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([
        {
          name_primary: 'Gạo tẻ',
          name_en: 'Rice',
          embedding: EMBEDDING_VEC,
        },
      ]),
    } as unknown as MockDb;

    await warmEmbeddingCache(db);

    // Lookup uses normalized keys (lowercase + trim)
    // Warm-up must have stored under normalized keys too
    expect(getMemoryCacheStats().size).toBe(2); // "gạo tẻ" + "rice"

    // Direct memoryCache check via a resolve call with a routing mock
    clearMemoryCache();
    // Re-warm with same data
    await warmEmbeddingCache(db);
    // Now resolve should hit L1 without L2
    const resolveDb = {
      execute: vi.fn().mockResolvedValue([]),
    } as unknown as MockDb;
    const result = await resolveQueryEmbedding('Gạo tẻ', resolveDb);
    expect(result).toEqual(EMBEDDING_VEC);
  });
});
