import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUser = { id: 'user-123', email: 'test@example.com' };
const mockProfile = {
  userId: 'user-123',
  goal: 'cutting',
  calorieTarget: 2000,
  proteinTargetG: 100,
  carbsTargetG: 180,
  fatTargetG: 60,
};
const mockWeightSummary = {
  range: '30d',
  weights: [69.6, 69.2],
  currentWeight: 69.2,
  todayWeight: 69.2,
  weightPlaceholder: 69.2,
  daysLogged: 2,
  periodStartWeight: 69.6,
  expectedEndWeight: 69.2,
  goalDirection: 'down' as const,
};

const mockDbSelect = vi.fn();
const mockLoadWeightSummaryAction = vi.fn().mockResolvedValue(mockWeightSummary);

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

vi.mock('@/lib/actions/weight', () => ({
  loadWeightSummaryAction: mockLoadWeightSummaryAction,
}));

import { loadDashboardSnapshotAction } from '@/lib/actions/dashboard';

function shiftDate(dateString: string, deltaDays: number): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

describe('loadDashboardSnapshotAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds dashboard metrics from persisted meals and weight data', async () => {
    const todayDate = new Date().toISOString().slice(0, 10);
    const mealRows = Array.from({ length: 7 }, (_, index) => {
      const date = shiftDate(todayDate, -index);
      return [
        {
          id: `meal-${index}-a`,
          rawInput: `Meal A ${index}`,
          loggedAt: new Date(`${date}T12:00:00.000Z`),
          localDate: date,
          caloriesKcal: 900,
          proteinG: 40,
          carbohydrateG: 80,
          fatG: 20,
        },
        {
          id: `meal-${index}-b`,
          rawInput: `Meal B ${index}`,
          loggedAt: new Date(`${date}T18:00:00.000Z`),
          localDate: date,
          caloriesKcal: 600,
          proteinG: 60,
          carbohydrateG: 70,
          fatG: 30,
        },
      ];
    }).flat();

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mealRows),
        }),
      }),
    });

    const snapshot = await loadDashboardSnapshotAction({
      range: '30d',
      timezoneOffset: 0,
    });

    expect(mockLoadWeightSummaryAction).toHaveBeenCalledWith({
      range: '30d',
      timezoneOffset: 0,
    });
    expect(snapshot.weightSummary).toEqual(mockWeightSummary);
    expect(snapshot.verdict.weeklyRate).toBe(-0.4);
    expect(snapshot.verdict.status).toBe('on_pace');
    expect(snapshot.verdict.totalDelta).toBe(-0.4);
    expect(snapshot.verdict.proteinDays).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(snapshot.nutrition.calories).toEqual({ current: 1500, target: 2000 });
    expect(snapshot.nutrition.protein).toEqual({ current: 100, target: 100 });
    expect(snapshot.stats.avgDeficit).toBe(500);
    expect(snapshot.meals).toHaveLength(2);
    expect(snapshot.meals[0]?.label).toBe('Meal B 0');
    expect(snapshot.meals[1]?.label).toBe('Meal A 0');
    expect(snapshot.heatmap).toHaveLength(7);
    expect(snapshot.heatmap[0]).toHaveLength(4);
    expect(snapshot.heatmap[0]?.[3]).toBe(1);
    expect(snapshot.heatmap[1]?.[3]).toBe(1);
  });

  it('rejects invalid dashboard range input', async () => {
    await expect(
      loadDashboardSnapshotAction({
        range: '14d' as never,
        timezoneOffset: 0,
      })
    ).rejects.toThrow();
  });
});
