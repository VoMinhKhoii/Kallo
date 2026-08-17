import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();
const requireAuthAndProfile = vi.fn();
const resolveQueryEmbedding = vi.fn();
const cacheQueryEmbedding = vi.fn();
const generateEmbeddingBatch = vi.fn();

vi.mock('@/lib/infra/db', () => ({
  db: { execute },
}));

vi.mock('@/lib/infra/auth/session', () => ({
  requireAuthAndProfile,
}));

vi.mock('@/lib/ai/cache/embedding-cache', () => ({
  resolveQueryEmbedding,
  cacheQueryEmbedding,
}));

vi.mock('@/lib/ai/provider/provider', () => ({
  resolveGeminiProvider: () => ({ kind: 'test' }),
  createGeminiClient: () => ({ generateEmbeddingBatch }),
}));

const { GET } = await import('@/app/api/v1/ingredients/search/route');

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/v1/ingredients/search');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return { nextUrl: url } as unknown as NextRequest;
}

// DB rows arrive snake_case with numeric columns as strings.
const riceDbRow = {
  id: 'fct-rice',
  name_primary: 'Cơm trắng',
  name_alt: ['cơm'],
  name_en: 'White rice',
  state: 'cooked',
  similarity: 0.92,
  calories_kcal: '130',
  protein_g: '2.7',
  carbohydrate_g: '28',
  fat_g: null,
};

beforeEach(() => {
  execute.mockReset();
  requireAuthAndProfile.mockReset();
  resolveQueryEmbedding.mockReset();
  cacheQueryEmbedding.mockReset();
  generateEmbeddingBatch.mockReset();
  requireAuthAndProfile.mockResolvedValue({
    user: { id: 'user-123' },
    profile: {},
  });
  // Default: no cached embedding and no live embedding → semantic path
  // degrades silently unless a test opts in.
  resolveQueryEmbedding.mockResolvedValue(null);
  generateEmbeddingBatch.mockResolvedValue([]);
});

describe('GET /api/v1/ingredients/search', () => {
  it('returns mapped results with parsed numeric strings', async () => {
    // Fuzzy query fills the limit — no supplemental query fires.
    execute.mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => ({
        ...riceDbRow,
        id: `fct-${i}`,
      }))
    );

    const res = await GET(makeRequest({ q: 'com trang' }));
    expect(res.status).toBe(200);

    const { results } = await res.json();
    expect(results).toHaveLength(10);
    expect(results[0]).toMatchObject({
      id: 'fct-0',
      namePrimary: 'Cơm trắng',
      nameEn: 'White rice',
      state: 'cooked',
      similarity: 0.92,
      per100g: {
        caloriesKcal: 130,
        proteinG: 2.7,
        carbohydrateG: 28,
        fatG: null,
      },
    });
    expect(execute).toHaveBeenCalledTimes(1);
    // Manual search must use the word_similarity-ranked all-sources function
    // (shared with the v2 AI matcher) — the whole-string-ranked
    // fuzzy_match_ingredients buries body-part entries ("ức gà") under short
    // generic names.
    expect(JSON.stringify(execute.mock.calls[0][0])).toContain(
      'fuzzy_match_ingredients_all_sources'
    );
  });

  it('backfills short-query results with the substring fallback, deduped', async () => {
    execute
      .mockResolvedValueOnce([riceDbRow]) // fuzzy: one hit
      .mockResolvedValueOnce([
        riceDbRow, // duplicate of the fuzzy hit — must be dropped
        { ...riceDbRow, id: 'fct-rice-2', name_primary: 'Cơm gạo lứt' },
      ]);

    const res = await GET(makeRequest({ q: 'cơm' }));
    const { results } = await res.json();

    expect(execute).toHaveBeenCalledTimes(2);
    expect(results.map((r: { id: string }) => r.id)).toEqual([
      'fct-rice',
      'fct-rice-2',
    ]);
  });

  it('supplements weak lexical results with semantic matches, flagged and deduped', async () => {
    // Vocabulary gap: nothing lexical matches well ("lườn gà" shares no
    // trigrams with breast entries) → the embedding supplement kicks in.
    resolveQueryEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    execute
      .mockResolvedValueOnce([{ ...riceDbRow, similarity: 0.2 }]) // weak fuzzy
      .mockResolvedValueOnce([
        { ...riceDbRow, similarity: 0.9 }, // duplicate of the lexical hit
        {
          ...riceDbRow,
          id: 'fct-breast',
          name_primary: 'Ức gà',
          similarity: 0.85,
        },
      ]) // match_ingredients
      .mockResolvedValueOnce([]); // substring backfill

    const res = await GET(makeRequest({ q: 'lườn gà' }));
    const { results } = await res.json();

    expect(JSON.stringify(execute.mock.calls[1][0])).toContain(
      'match_ingredients'
    );
    const ids = results.map((r: { id: string }) => r.id);
    expect(ids).toEqual(['fct-rice', 'fct-breast']); // deduped, lexical first
    expect(results[0].semantic).toBeUndefined(); // lexical hits unflagged
    expect(results[1].semantic).toBe(true);
  });

  it('rank-fuses a semantic hit above wrong-but-lexically-similar offal (ức gà)', async () => {
    // The core fix: "ức gà" (breast) shares only the dominant "gà" token with
    // "Mề gà"/"Tim gà" (offal), which therefore outrank it lexically. The
    // embedding arm puts the breast first, and RRF fusion promotes it.
    resolveQueryEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    execute
      .mockResolvedValueOnce([
        {
          ...riceDbRow,
          id: 'fao-gizzard',
          name_primary: 'Mề gà',
          similarity: 0.55,
        },
        {
          ...riceDbRow,
          id: 'fao-heart',
          name_primary: 'Tim gà',
          similarity: 0.52,
        },
        {
          ...riceDbRow,
          id: 'usda-breast',
          name_primary: 'Ức gà',
          similarity: 0.5,
        },
      ]) // lexical: offal outranks the breast on the shared "gà" token
      .mockResolvedValueOnce([
        {
          ...riceDbRow,
          id: 'usda-breast',
          name_primary: 'Ức gà',
          similarity: 0.82,
        },
      ]) // semantic: the breast is the nearest embedding
      .mockResolvedValueOnce([]); // substring backfill

    const res = await GET(makeRequest({ q: 'ức gà' }));
    const { results } = await res.json();

    // breast: lexical rank 2 (1/62) + semantic rank 0 (1/60) beats
    // gizzard: lexical rank 0 (1/60) alone.
    expect(results[0].id).toBe('usda-breast');
    // found by both arms → kept as a normal hit, not "≈ related"
    expect(results[0].semantic).toBeUndefined();
  });

  it('runs the semantic arm even when lexical saturates, so meaning wins over token collisions (cơm)', async () => {
    // word_similarity saturates: "Cá cơm" (anchovy) ties at ~1.0 with rice
    // because both contain the "cơm" token. A high lexical score must NOT
    // suppress the embedding arm — only the embedding knows "cơm" means rice.
    resolveQueryEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    execute
      .mockResolvedValueOnce([
        {
          ...riceDbRow,
          id: 'anchovy',
          name_primary: 'Cá cơm',
          similarity: 1.001,
        },
        {
          ...riceDbRow,
          id: 'rice',
          name_primary: 'Cơm trắng',
          similarity: 1.0004,
        },
      ]) // lexical: anchovy tied at the top via the shared "cơm" token
      .mockResolvedValueOnce([
        {
          ...riceDbRow,
          id: 'rice',
          name_primary: 'Cơm trắng',
          similarity: 0.85,
        },
      ]) // semantic: only rice is semantically "cơm"
      .mockResolvedValueOnce([]); // substring backfill

    const res = await GET(makeRequest({ q: 'cơm' }));
    const { results } = await res.json();

    expect(resolveQueryEmbedding).toHaveBeenCalled();
    // rice: lexical rank 1 (1/61) + weighted semantic rank 0 (2/60) beats
    // anchovy: lexical rank 0 (1/60) alone.
    expect(results[0].id).toBe('rice');
  });

  it('live-embeds and caches when the query has no cached embedding', async () => {
    resolveQueryEmbedding.mockResolvedValue(null);
    generateEmbeddingBatch.mockResolvedValue([[0.5, 0.6]]);
    execute
      .mockResolvedValueOnce([]) // no fuzzy hits
      .mockResolvedValueOnce([{ ...riceDbRow, similarity: 0.8 }]) // vector
      .mockResolvedValueOnce([]); // substring backfill

    const res = await GET(makeRequest({ q: 'lườn gà' }));
    const { results } = await res.json();

    expect(generateEmbeddingBatch).toHaveBeenCalledWith(['lườn gà']);
    expect(cacheQueryEmbedding).toHaveBeenCalled();
    expect(results[0].semantic).toBe(true);
  });

  it('degrades to lexical-only when the embedding path fails', async () => {
    resolveQueryEmbedding.mockRejectedValue(new Error('embed infra down'));
    execute
      .mockResolvedValueOnce([{ ...riceDbRow, similarity: 0.2 }]) // weak fuzzy
      .mockResolvedValueOnce([]); // substring backfill

    const res = await GET(makeRequest({ q: 'lườn gà' }));
    expect(res.status).toBe(200);
    const { results } = await res.json();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('fct-rice');
  });

  it('returns the recent-foods list when q is empty', async () => {
    execute.mockResolvedValueOnce([{ ...riceDbRow, similarity: null }]);

    const res = await GET(makeRequest({}));
    const { results } = await res.json();

    expect(execute).toHaveBeenCalledTimes(1);
    expect(results[0].similarity).toBe(1);
    // The recents query is scoped to the authenticated user.
    const sqlQuery = execute.mock.calls[0][0];
    expect(JSON.stringify(sqlQuery)).toContain('user-123');
  });

  it('rejects an unauthenticated request', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    requireAuthAndProfile.mockRejectedValueOnce(Errors.notAuthenticated());

    const res = await GET(makeRequest({ q: 'com' }));
    expect(res.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects an invalid limit', async () => {
    const res = await GET(makeRequest({ q: 'com', limit: '999' }));
    expect(res.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
});
