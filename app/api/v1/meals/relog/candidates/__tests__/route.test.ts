import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadRelogCandidatesAction = vi.fn();
const requireAuthAndProfile = vi.fn();
const checkAnalysisGuards = vi.fn();

vi.mock('@/lib/actions/meals/relog/load-candidates', () => ({
  loadRelogCandidatesAction,
}));

vi.mock('@/lib/auth', () => ({ requireAuthAndProfile }));

vi.mock('@/lib/rate-limit/analysis-guards', () => ({ checkAnalysisGuards }));

const { GET } = await import('@/app/api/v1/meals/relog/candidates/route');

function makeRequest(query: string): NextRequest {
  return {
    nextUrl: new URL(
      `https://example.test/api/v1/meals/relog/candidates${query}`
    ),
  } as unknown as NextRequest;
}

const candidates = { dishes: [], meals: [] };
const release = vi.fn();

beforeEach(() => {
  loadRelogCandidatesAction.mockReset();
  requireAuthAndProfile.mockReset();
  checkAnalysisGuards.mockReset();
  release.mockReset();
  loadRelogCandidatesAction.mockResolvedValue(candidates);
  requireAuthAndProfile.mockResolvedValue({
    user: { id: 'user-123' },
    profile: {},
  });
  checkAnalysisGuards.mockResolvedValue({ allowed: true, release });
});

describe('GET /api/v1/meals/relog/candidates', () => {
  it('searches for the authenticated user', async () => {
    const res = await GET(makeRequest('?q=pho&limit=8'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(candidates);
    expect(loadRelogCandidatesAction).toHaveBeenCalledWith({
      q: 'pho',
      limit: 8,
    });
  });

  it('treats an empty query as the ranked staples, not an error', async () => {
    const res = await GET(makeRequest(''));

    expect(res.status).toBe(200);
    expect(loadRelogCandidatesAction).toHaveBeenCalledWith({
      q: '',
      limit: 8,
    });
  });

  it('clamps limit above the contract maximum', async () => {
    const res = await GET(makeRequest('?limit=999'));
    expect(res.status).toBe(400);
    expect(loadRelogCandidatesAction).not.toHaveBeenCalled();
  });

  describe('auth ordering', () => {
    it('authenticates BEFORE validating the query', async () => {
      // Otherwise a bad `limit` returns 400 to an anonymous caller and a valid
      // one returns 401 — a free oracle for which params are well-formed.
      const { Errors } = await import('@/lib/errors');
      requireAuthAndProfile.mockRejectedValueOnce(Errors.notAuthenticated());

      const res = await GET(makeRequest('?limit=999'));

      expect(res.status).toBe(401);
      expect(checkAnalysisGuards).not.toHaveBeenCalled();
      expect(loadRelogCandidatesAction).not.toHaveBeenCalled();
    });
  });

  describe('rate limiting', () => {
    it('throttles per user before running the search', async () => {
      // The search is two unindexed LIKE scans over a year of the user's meals;
      // the only prior defence was a client-side debounce, which curl ignores.
      checkAnalysisGuards.mockResolvedValue({
        allowed: false,
        status: 429,
        reason: 'per_user_minute',
        retryAfterSeconds: 17,
      });

      const res = await GET(makeRequest('?q=pho'));

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('17');
      expect(loadRelogCandidatesAction).not.toHaveBeenCalled();
    });

    it('guards on the authenticated user id and its own route key', async () => {
      await GET(makeRequest('?q=pho'));

      expect(checkAnalysisGuards).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          route: 'meals-relog-candidates',
        })
      );
    });

    it('releases the in-flight slot on success and on failure', async () => {
      await GET(makeRequest('?q=pho'));
      expect(release).toHaveBeenCalledTimes(1);

      loadRelogCandidatesAction.mockRejectedValueOnce(new Error('boom'));
      await GET(makeRequest('?q=pho'));
      expect(release).toHaveBeenCalledTimes(2);
    });
  });
});
