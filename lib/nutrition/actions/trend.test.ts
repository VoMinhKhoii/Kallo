import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFetchTrendRows, mockRequireAuthAndProfile } = vi.hoisted(() => ({
  mockFetchTrendRows: vi.fn(),
  mockRequireAuthAndProfile: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuthAndProfile: mockRequireAuthAndProfile,
}));

vi.mock('./trend-query', () => ({
  fetchTrendRows: mockFetchTrendRows,
}));

import { getNutrientTrend } from './trend';
import { fetchTrendRows } from './trend-query';

describe('getNutrientTrend', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25T12:00:00.000Z'));
    vi.clearAllMocks();
    mockRequireAuthAndProfile.mockResolvedValue({
      user: { id: 'user-1' },
      profile: {},
    });
    mockFetchTrendRows.mockResolvedValue([
      { localDate: '2026-04-23', calories: 100, value: 5 },
      { localDate: '2026-04-24', calories: 100, value: null },
      { localDate: '2026-04-25', calories: 100, value: 7 },
      { localDate: '2026-04-25', calories: 60, value: null },
    ]);
  });

  it('rejects hidden nutrient keys', async () => {
    await expect(
      getNutrientTrend({
        nutrient: 'vitaminHMcg',
        range: '7d',
        timezoneOffset: null,
      })
    ).rejects.toThrow();
  });

  it('passes only the requested nutrient into fetchTrendRows', async () => {
    await getNutrientTrend({
      nutrient: 'ironMg',
      range: '7d',
      timezoneOffset: null,
    });

    expect(fetchTrendRows).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        nutrient: 'ironMg',
      })
    );
  });

  it('returns points for the requested nutrient only', async () => {
    const trend = await getNutrientTrend({
      nutrient: 'ironMg',
      range: '7d',
      timezoneOffset: null,
    });

    expect(trend).toMatchObject({
      nutrient: 'ironMg',
      range: '7d',
      displayMode: 'line',
      points: [
        { date: '2026-04-23', value: 5, confidence: 100 },
        { date: '2026-04-24', value: null, confidence: 0 },
        { date: '2026-04-25', value: 7, confidence: 62.5 },
      ],
    });
  });
});
