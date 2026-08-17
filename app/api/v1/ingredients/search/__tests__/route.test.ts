import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The ranking itself is tested in
// `lib/domain/ingredients/search/__tests__/`. This file covers only what the
// route owns: auth, query-param parsing, and the response envelope.
const searchIngredients = vi.fn();
const requireAuthAndProfile = vi.fn();

vi.mock('@/lib/domain/ingredients/search/ingredient-search', () => ({
  searchIngredients,
}));

vi.mock('@/lib/infra/auth/session', () => ({
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

beforeEach(() => {
  searchIngredients.mockReset();
  requireAuthAndProfile.mockReset();
  requireAuthAndProfile.mockResolvedValue({
    user: { id: 'user-123' },
    profile: {},
  });
  searchIngredients.mockResolvedValue([]);
});

describe('GET /api/v1/ingredients/search', () => {
  it('passes the parsed query, limit and user id to the search', async () => {
    const res = await GET(makeRequest({ q: 'com trang', limit: '5' }));

    expect(res.status).toBe(200);
    expect(searchIngredients).toHaveBeenCalledWith({
      userId: 'user-123',
      q: 'com trang',
      limit: 5,
    });
  });

  it('defaults to an empty query and a limit of 10', async () => {
    await GET(makeRequest({}));

    expect(searchIngredients).toHaveBeenCalledWith({
      userId: 'user-123',
      q: '',
      limit: 10,
    });
  });

  it('trims the query, so whitespace-only means "no query"', async () => {
    await GET(makeRequest({ q: '  cơm  ' }));
    expect(searchIngredients).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'cơm' })
    );

    await GET(makeRequest({ q: '   ' }));
    expect(searchIngredients).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: '' })
    );
  });

  it('wraps the results in a `results` envelope', async () => {
    searchIngredients.mockResolvedValue([{ id: 'fct-rice' }]);

    const res = await GET(makeRequest({ q: 'com' }));

    await expect(res.json()).resolves.toEqual({
      results: [{ id: 'fct-rice' }],
    });
  });

  it('rejects an unauthenticated request before searching', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    requireAuthAndProfile.mockRejectedValueOnce(Errors.notAuthenticated());

    const res = await GET(makeRequest({ q: 'com' }));

    expect(res.status).toBe(401);
    expect(searchIngredients).not.toHaveBeenCalled();
  });

  it('rejects an over-cap limit', async () => {
    const res = await GET(makeRequest({ q: 'com', limit: '999' }));

    expect(res.status).toBe(400);
    expect(searchIngredients).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric limit', async () => {
    const res = await GET(makeRequest({ q: 'com', limit: 'abc' }));

    expect(res.status).toBe(400);
    expect(searchIngredients).not.toHaveBeenCalled();
  });
});
