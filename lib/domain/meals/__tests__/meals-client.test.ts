import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn(async () => []));
vi.mock('@/lib/api/client-fetch', () => ({ request }));

const client = await import('@/lib/domain/meals/meals-client');
const { fetchNutritionOverview } = await import(
  '@/lib/domain/nutrition/nutrition-client'
);
const { fetchCalorieAdherenceHeatmap, fetchWeightSummary } = await import(
  '@/lib/domain/dashboard/dashboard-client'
);

beforeEach(() => request.mockClear());

// Each fetcher must hit the GET route that wraps the action it replaced, with
// the query parameter names that route parses (`tz`, not `timezoneOffset`).
describe('page read fetchers', () => {
  it.each([
    [
      () =>
        client.fetchMealsByDate({ date: '2026-10-27', timezoneOffset: -420 }),
      '/api/v1/meals?date=2026-10-27&tz=-420',
    ],
    [
      () => client.fetchLoggingDay({ date: '2026-10-27', timezoneOffset: 0 }),
      '/api/v1/logging/day?date=2026-10-27&tz=0',
    ],
    [
      () => client.fetchMealDateSummaries({ timezoneOffset: 60 }),
      '/api/v1/meals/dates/summaries?tz=60',
    ],
    [
      () => client.fetchRecentCheatOccasions({ limit: 5 }),
      '/api/v1/meals/cheat-occasions?limit=5',
    ],
    [
      () => client.fetchRelogCandidates({ q: 'phở bò & cơm', limit: 8 }),
      '/api/v1/meals/relog/candidates?q=ph%E1%BB%9F+b%C3%B2+%26+c%C6%A1m&limit=8',
    ],
    [
      () =>
        fetchCalorieAdherenceHeatmap({ range: 'year', timezoneOffset: -420 }),
      '/api/v1/dashboard/heatmap?range=year&tz=-420',
    ],
    [
      () => fetchWeightSummary({ range: '30d', timezoneOffset: -420 }),
      '/api/v1/weight/summary?range=30d&tz=-420',
    ],
    [
      () =>
        fetchNutritionOverview({
          range: 'auto',
          timezoneOffset: -420,
          days: 'complete',
        }),
      '/api/v1/nutrition/overview?range=auto&days=complete&tz=-420',
    ],
    [
      () =>
        fetchNutritionOverview({
          range: '30d',
          timezoneOffset: null,
          days: 'all',
        }),
      '/api/v1/nutrition/overview?range=30d&days=all',
    ],
  ])('%#: requests the matching GET route', async (call, url) => {
    await call();
    expect(request).toHaveBeenCalledWith(url);
  });
});
