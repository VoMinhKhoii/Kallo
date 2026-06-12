import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();
const requireAuthAndProfile = vi.fn();

vi.mock('@/lib/db', () => ({
  db: { execute },
}));

vi.mock('@/lib/auth', () => ({
  requireAuthAndProfile,
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
  requireAuthAndProfile.mockResolvedValue({
    user: { id: 'user-123' },
    profile: {},
  });
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
    // Manual search must use the word_similarity-ranked function — the
    // whole-string-ranked fuzzy_match_ingredients buries body-part entries
    // ("ức gà") under short generic names.
    expect(JSON.stringify(execute.mock.calls[0][0])).toContain(
      'search_ingredients_by_name'
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
    const { Errors } = await import('@/lib/errors');
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
