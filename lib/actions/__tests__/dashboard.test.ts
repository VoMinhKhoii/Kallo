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

// NOTE: loadDashboardSnapshotAction doesn't exist yet.
// Dashboard uses individual queries (heatmap, verdict, weight) from mock data.
// This test suite is preserved as a reference for future snapshot action implementation.
