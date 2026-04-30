import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbSelect = vi.fn();
const mockBuildCalorieAdherenceHeatmap = vi.fn().mockReturnValue([
  [1, null],
  [null, 1],
]);
const mockUser = { id: 'user-123', email: 'test@example.com' };
const mockProfile = {
  userId: 'user-123',
  goal: 'cutting',
  calorieTarget: 2000,
  proteinTargetG: 100,
  carbsTargetG: 180,
  fatTargetG: 60,
};

vi.mock('@/lib/auth', () => ({
  requireAuthAndProfile: vi.fn().mockResolvedValue({
    user: mockUser,
    profile: mockProfile,
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: mockDbSelect,
  },
}));

vi.mock('@/lib/dashboard/adherence', () => ({
  buildCalorieAdherenceHeatmap: mockBuildCalorieAdherenceHeatmap,
  getLocalDateKey: vi.fn(() => '2026-05-01'),
}));

import { loadCalorieAdherenceHeatmap } from '@/lib/actions/dashboard';

describe('loadCalorieAdherenceHeatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads meal rows and builds the heatmap snapshot', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              { date: '2026-04-30', calories: '1200' },
              { date: '2026-05-01', calories: '1800' },
            ]),
          }),
        }),
      }),
    });

    const heatmap = await loadCalorieAdherenceHeatmap({
      range: '30d',
      timezoneOffset: 0,
    });

    expect(heatmap).toEqual([
      [1, null],
      [null, 1],
    ]);
    expect(mockDbSelect).toHaveBeenCalledTimes(1);
    expect(mockBuildCalorieAdherenceHeatmap).toHaveBeenCalledWith(
      expect.objectContaining({
        range: '30d',
        calorieTarget: 2000,
        timezoneOffset: 0,
        dailyCalories: [
          { date: '2026-04-30', calories: 1200 },
          { date: '2026-05-01', calories: 1800 },
        ],
      })
    );
  });

  it('rejects invalid range input', async () => {
    await expect(
      loadCalorieAdherenceHeatmap({
        range: '14d' as never,
        timezoneOffset: 0,
      })
    ).rejects.toThrow();
  });
});
