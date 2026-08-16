import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

var mockDbSelect: ReturnType<typeof vi.fn>;
var mockBuildCalorieAdherenceHeatmapData: ReturnType<typeof vi.fn>;
var mockLoadWeightSummaryAction: ReturnType<typeof vi.fn>;

vi.mock('@/lib/auth/session', () => ({
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

vi.mock('@/lib/db', () => {
  mockDbSelect = vi.fn();

  return {
    db: {
      select: mockDbSelect,
    },
  };
});

vi.mock('@/lib/dashboard/adherence', () => {
  mockBuildCalorieAdherenceHeatmapData = vi.fn();

  return {
    buildCalorieAdherenceHeatmapData: mockBuildCalorieAdherenceHeatmapData,
    getLocalDateKey: vi.fn(() => '2026-05-01'),
  };
});

vi.mock('@/lib/actions/weight', () => {
  mockLoadWeightSummaryAction = vi.fn();

  return {
    loadWeightSummaryAction: mockLoadWeightSummaryAction,
  };
});

import {
  loadCalorieAdherenceHeatmap,
  loadVerdictAction,
} from '@/lib/actions/dashboard';

describe('loadCalorieAdherenceHeatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildCalorieAdherenceHeatmapData.mockReturnValue({
      cells: [
        [
          { date: '2026-04-30', ratio: 0.6, status: 'logged' },
          { date: '2026-05-01', ratio: 0.9, status: 'logged' },
        ],
      ],
      monthHeaders: [{ month: 'May', startColumn: 0, span: 2 }],
    });
  });

  it('loads meal rows and builds the heatmap snapshot', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              { date: '2026-04-30', calories: '1200', hasCheatMeal: false },
              { date: '2026-05-01', calories: '1800', hasCheatMeal: true },
            ]),
          }),
        }),
      }),
    });

    const heatmap = await loadCalorieAdherenceHeatmap({
      range: '30d',
      timezoneOffset: 0,
    });

    expect(heatmap.cells[0]).toHaveLength(2);
    expect(heatmap.monthHeaders).toEqual([
      { month: 'May', startColumn: 0, span: 2 },
    ]);
    expect(mockDbSelect).toHaveBeenCalledTimes(1);
    expect(mockBuildCalorieAdherenceHeatmapData).toHaveBeenCalledWith(
      expect.objectContaining({
        range: '30d',
        calorieTarget: 2000,
        timezoneOffset: 0,
        dailyCalories: [
          { date: '2026-04-30', calories: 1200, hasCheatMeal: false },
          { date: '2026-05-01', calories: 1800, hasCheatMeal: true },
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
      periodElapsedDays: 6,
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

/**
 * Both dashboard actions validate the same `timezoneOffset` field, so they must
 * accept the same values. Real UTC offsets span -12:00..+14:00; expressed in
 * the codebase's `Date.getTimezoneOffset()` sign convention (inverted) that is
 * -840..720, which is what the shared `timezoneOffsetSchema` enforces.
 */
describe('dashboard timezoneOffset validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Whichever error the action throws, was it the input validation? */
  async function zodErrorFrom(run: () => Promise<unknown>) {
    try {
      await run();
      return null;
    } catch (error) {
      return error instanceof ZodError ? error : null;
    }
  }

  const heatmap = (timezoneOffset: number) => () =>
    loadCalorieAdherenceHeatmap({ range: '30d', timezoneOffset });
  const verdict = (timezoneOffset: number) => () =>
    loadVerdictAction({ timezoneOffset });

  it.each([
    -1441, -1440, -841, 721, 1440, 1441,
  ])('both actions reject out-of-range offset %i', async (timezoneOffset) => {
    expect(await zodErrorFrom(heatmap(timezoneOffset))).toBeInstanceOf(
      ZodError
    );
    expect(await zodErrorFrom(verdict(timezoneOffset))).toBeInstanceOf(
      ZodError
    );
  });

  it.each([
    -840, -420, 0, 330, 720,
  ])('both actions accept in-range offset %i', async (timezoneOffset) => {
    expect(await zodErrorFrom(heatmap(timezoneOffset))).toBeNull();
    expect(await zodErrorFrom(verdict(timezoneOffset))).toBeNull();
  });
});
