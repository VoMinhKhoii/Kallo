import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbSelect = vi.fn();
const mockBuildCalorieAdherenceHeatmap = vi.fn().mockReturnValue([
  [1, null],
  [null, 1],
]);

vi.mock('@/lib/auth', () => ({
  requireAuthAndProfile: vi.fn().mockResolvedValue({
    user: { id: 'user-123', email: 'test@example.com' },
    profile: {
      userId: 'user-123',
      goal: 'cutting',
      calorieTarget: 2000,
      proteinTargetG: 100,
      carbsTargetG: 180,
      fatTargetG: 60,
    },
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

const mockLoadWeightSummaryAction = vi.fn();

vi.mock('@/lib/actions/weight', () => ({
  loadWeightSummaryAction: mockLoadWeightSummaryAction,
}));

import {
  loadCalorieAdherenceHeatmap,
  loadVerdictAction,
} from '@/lib/actions/dashboard';

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

describe('loadVerdictAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads verdict data from weight summary and meals', async () => {
    mockLoadWeightSummaryAction.mockResolvedValue({
      range: '30d',
      weights: [70, 69.8, 69.6, 69.4, 69.2, 69, 68.8],
      currentWeight: 68.8,
      todayWeight: null,
      weightPlaceholder: 68.8,
      daysLogged: 7,
      periodStartWeight: 70,
      expectedEndWeight: 68.8,
      goalDirection: 'down',
    });

    // Set up mock for first query (weight with just orderBy)
    const weightOrderBy = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([{ loggedDate: '2026-03-01' }]),
    });

    // Set up mock for second query (protein with groupBy)
    const proteinOrderBy = vi
      .fn()
      .mockResolvedValue([{ date: '2026-05-01', protein: '120' }]);

    const mockFrom = vi.fn();
    const mockWhere = vi.fn();

    mockFrom.mockReturnValue({
      where: mockWhere,
    });

    mockWhere
      .mockReturnValueOnce({
        orderBy: weightOrderBy,
      })
      .mockReturnValueOnce({
        groupBy: vi.fn().mockReturnValue({
          orderBy: proteinOrderBy,
        }),
      });

    mockDbSelect.mockReturnValue({
      from: mockFrom,
    });

    const verdict = await loadVerdictAction({
      timezoneOffset: 0,
    });

    expect(verdict).toMatchObject({
      weeklyRate: expect.any(Number),
      totalDelta: expect.any(Number),
      planStartDate: expect.any(String),
      status: expect.any(String),
      rollingAvg: expect.any(Object),
      currentWeight: 68.8,
      proteinDays: expect.any(Array),
    });
    expect(mockLoadWeightSummaryAction).toHaveBeenCalledWith({
      range: '30d',
      timezoneOffset: 0,
    });
  });
});
