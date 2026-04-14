export type WeightRange = '30d' | '90d';

export type WeightGoalDirection = 'up' | 'down';

export interface WeightSummaryData {
  range: WeightRange;
  weights: number[];
  currentWeight: number;
  todayWeight: number | null;
  weightPlaceholder: number;
  daysLogged: number;
  periodStartWeight: number;
  expectedEndWeight: number;
  goalDirection: WeightGoalDirection;
}
