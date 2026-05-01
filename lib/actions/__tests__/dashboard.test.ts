import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbSelect = vi.fn();
const mockBuildCalorieAdherenceHeatmap = vi.fn().mockReturnValue([
  [1, null],
  [null, 1],
]);
const mockLoadWeightSummaryAction = vi.fn();

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

    // Mock rows in descending order (most recent first) to match DB orderBy(desc(...))
    const weightQueryOrderBy = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([
        { loggedDate: '2026-05-01', weightKg: '68.7' },
        { loggedDate: '2026-04-30', weightKg: '68.8' },
        { loggedDate: '2026-04-29', weightKg: '68.9' },
        { loggedDate: '2026-04-28', weightKg: '69.0' },
        { loggedDate: '2026-04-27', weightKg: '69.1' },
        { loggedDate: '2026-04-26', weightKg: '69.2' },
        { loggedDate: '2026-04-25', weightKg: '69.3' },
        { loggedDate: '2026-04-24', weightKg: '69.4' },
        { loggedDate: '2026-04-23', weightKg: '69.5' },
        { loggedDate: '2026-04-22', weightKg: '69.6' },
        { loggedDate: '2026-04-21', weightKg: '69.7' },
        { loggedDate: '2026-04-20', weightKg: '69.8' },
        { loggedDate: '2026-04-19', weightKg: '69.9' },
        { loggedDate: '2026-04-18', weightKg: '70.0' },
      ]),
    });

    const proteinQueryOrderBy = vi.fn().mockResolvedValue([
      { date: '2026-04-25', weekday: 6, protein: '120' },
      { date: '2026-04-26', weekday: 7, protein: '80' },
      { date: '2026-04-27', weekday: 1, protein: '110' },
      { date: '2026-04-28', weekday: 2, protein: '90' },
      { date: '2026-04-29', weekday: 3, protein: '130' },
      { date: '2026-04-30', weekday: 4, protein: '70' },
      { date: '2026-05-01', weekday: 5, protein: '100' },
    ]);

    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: weightQueryOrderBy,
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: proteinQueryOrderBy,
            }),
          }),
        }),
      });

    const verdict = await loadVerdictAction({
      timezoneOffset: 0,
    });

    // Assert numeric values with tolerance to avoid floating-point precision
    expect(verdict.planStartDate).toEqual('2026-04-18');
    expect(verdict.status).toEqual('ahead');
    expect(verdict.currentWeight).toEqual(68.8);
    expect(verdict.proteinDays).toEqual([
      true,
      false,
      true,
      false,
      true,
      true,
      false,
    ]);
    expect(verdict.rollingAvg).toEqual({ start: 69.7, end: 69 });
    expect(verdict.weeklyRate).toBeCloseTo(-0.7, 6);
    expect(verdict.totalDelta).toBeCloseTo(-1.2, 6);
    expect(mockLoadWeightSummaryAction).toHaveBeenCalledWith({
      range: '30d',
      timezoneOffset: 0,
    });
  });
});
