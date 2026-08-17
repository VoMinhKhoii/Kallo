export type WeightRange = '30d' | '90d';

export type WeightGoalDirection = 'up' | 'down' | 'flat';

export interface WeightSummaryData {
  range: WeightRange;
  weights: number[];
  /**
   * `YYYY-MM-DD` logged dates, parallel to `weights` (same length, same order).
   * Kept as a sibling array rather than folded into a `{ date, weightKg }[]`
   * so `weights` stays a bare `number[]` for every existing chart consumer —
   * clients that don't need dates simply ignore this field.
   */
  weightDates: string[];
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
