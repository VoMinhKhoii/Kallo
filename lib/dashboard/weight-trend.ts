import type { WeightGoalDirection, WeightRange } from '@/lib/types/weight';

export type WeightTrendStatus =
  | 'insufficient'
  | 'on_pace'
  | 'ahead'
  | 'behind'
  | 'stable';

interface BuildWeightTrendSummaryInput {
  weights: number[];
  periodStartWeight: number;
  expectedEndWeight: number;
  goalDirection: WeightGoalDirection;
  range: WeightRange;
  elapsedDays?: number | null;
}

export interface WeightTrendSummary {
  status: WeightTrendStatus;
  startWeight: number;
  currentWeight: number;
  expectedEndWeight: number;
  projectedEndWeight: number;
  actualWeeklyRate: number;
  expectedWeeklyRate: number;
  rangeDays: number;
  canProject: boolean;
}

const RANGE_DAYS: Record<WeightRange, number> = {
  '30d': 30,
  '90d': 90,
};

function isMovingWithGoal(
  actualWeeklyRate: number,
  expectedWeeklyRate: number,
  tolerance: number
): boolean {
  return Math.abs(actualWeeklyRate - expectedWeeklyRate) <= tolerance;
}

export function buildWeightTrendSummary({
  weights,
  periodStartWeight,
  expectedEndWeight,
  goalDirection,
  range,
  elapsedDays,
}: BuildWeightTrendSummaryInput): WeightTrendSummary {
  const rangeDays = RANGE_DAYS[range];
  const startWeight = weights[0] ?? periodStartWeight;
  const currentWeight = weights[weights.length - 1] ?? startWeight;
  const expectedWeeklyRate =
    ((expectedEndWeight - periodStartWeight) / rangeDays) * 7;
  const hasElapsedDays = typeof elapsedDays === 'number' && elapsedDays > 0;
  const actualWeeklyRate =
    ((currentWeight - startWeight) /
      (hasElapsedDays ? elapsedDays : rangeDays)) *
    7;
  const canProject =
    weights.length >= 3 && hasElapsedDays && elapsedDays < rangeDays;
  const projectedEndWeight = canProject
    ? currentWeight + actualWeeklyRate * ((rangeDays - elapsedDays) / 7)
    : currentWeight;
  const tolerance = Math.max(Math.abs(expectedWeeklyRate) * 0.2, 0.1);

  let status: WeightTrendStatus;
  if (weights.length < 2) {
    status = 'insufficient';
  } else if (goalDirection === 'flat') {
    status = Math.abs(actualWeeklyRate) <= 0.1 ? 'stable' : 'behind';
  } else if (
    isMovingWithGoal(actualWeeklyRate, expectedWeeklyRate, tolerance)
  ) {
    status = 'on_pace';
  } else if (
    (goalDirection === 'down' && actualWeeklyRate < expectedWeeklyRate) ||
    (goalDirection === 'up' && actualWeeklyRate > expectedWeeklyRate)
  ) {
    status = 'ahead';
  } else {
    status = 'behind';
  }

  return {
    status,
    startWeight,
    currentWeight,
    expectedEndWeight,
    projectedEndWeight,
    actualWeeklyRate,
    expectedWeeklyRate,
    rangeDays,
    canProject,
  };
}
