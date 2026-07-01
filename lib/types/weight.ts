export type WeightRange = '30d' | '90d';

export type WeightGoalDirection = 'up' | 'down' | 'flat';

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
  periodElapsedDays: number | null;
  /**
   * Projected end-of-period weight and whether a projection is meaningful,
   * computed once server-side (via `buildWeightTrendSummary`) so every client —
   * web and mobile — renders the forecast from the same numbers instead of
   * re-deriving it per platform.
   */
  projectedEndWeight: number;
  canProject: boolean;
}
