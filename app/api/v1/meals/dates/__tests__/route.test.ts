import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadMealDates = vi.fn();

vi.mock('@/lib/actions/meals/load-meals', () => ({ loadMealDates }));

const { GET } = await import('@/app/api/v1/meals/dates/route');

function makeRequest(query: string): NextRequest {
  return {
    nextUrl: new URL(`https://example.test/api/v1/meals/dates${query}`),
  } as unknown as NextRequest;
}

beforeEach(() => {
  loadMealDates.mockReset();
  loadMealDates.mockResolvedValue([
    { date: '2026-04-07', kcal: 2014 },
    { date: '2026-04-06', kcal: null },
  ]);
});

describe('GET /api/v1/meals/dates', () => {
  // This route's response shape is FROZEN. The Flutter app reads it as
  // `api.get<List<dynamic>>(...).then((list) => list.cast<String>())`
  // (apps/mobile-flutter/lib/features/logging/data/logging_providers.dart),
  // and a shipped build cannot be updated in lockstep with a web deploy — so
  // handing it objects throws on real devices. The web sidebar gets the richer
  // per-day shape straight from the action instead; this route flattens it.
  it('returns a bare array of date strings, never the summary objects', async () => {
    const res = await GET(makeRequest('?tz=0'));

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual(['2026-04-07', '2026-04-06']);
    for (const entry of body) {
      expect(typeof entry).toBe('string');
    }
  });

  it('passes the parsed timezone offset through to the action', async () => {
    await GET(makeRequest('?tz=-420'));

    expect(loadMealDates).toHaveBeenCalledWith({ timezoneOffset: -420 });
  });

  it('rejects a timezone offset outside the contract range', async () => {
    const res = await GET(makeRequest('?tz=99999'));

    expect(res.status).toBe(400);
    expect(loadMealDates).not.toHaveBeenCalled();
  });
});
