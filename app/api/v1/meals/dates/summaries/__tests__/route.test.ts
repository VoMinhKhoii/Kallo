import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadMealDates = vi.fn();

vi.mock('@/lib/actions/meals/meal-dates', () => ({ loadMealDates }));

const { GET } = await import('@/app/api/v1/meals/dates/summaries/route');

function makeRequest(query: string): NextRequest {
  return {
    nextUrl: new URL(
      `https://example.test/api/v1/meals/dates/summaries${query}`
    ),
  } as unknown as NextRequest;
}

beforeEach(() => {
  loadMealDates.mockReset();
});

describe('GET /api/v1/meals/dates/summaries', () => {
  it('returns the per-day summaries for the timezone', async () => {
    const summaries = [
      { date: '2026-04-07', kcal: 2014 },
      { date: '2026-04-06', kcal: null },
    ];
    loadMealDates.mockResolvedValue(summaries);

    const res = await GET(makeRequest('?tz=-420'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(summaries);
    expect(loadMealDates).toHaveBeenCalledWith({ timezoneOffset: -420 });
  });

  it('rejects a timezone offset outside the valid range', async () => {
    const res = await GET(makeRequest('?tz=99999'));

    expect(res.status).toBe(400);
    expect(loadMealDates).not.toHaveBeenCalled();
  });
});
