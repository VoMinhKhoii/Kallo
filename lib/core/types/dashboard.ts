import type { WeightSummaryData } from '@/lib/core/types/weight';
import type { Goal } from '@/lib/domain/onboarding/types';

export type WeightRange = '30d' | '90d';
export type TimeRange = WeightRange;
export type HeatmapRange = '30d' | '90d' | 'year';
export type HeatmapCellStatus =
  | 'logged'
  | 'partial'
  | 'unlogged'
  | 'future'
  | 'outside';

export interface HeatmapCell {
  date: string;
  /**
   * Adherence ratio for the consistency grid's colour grading — null for
   * partial (under-logged) days so they are not colour-graded.
   */
  ratio: number | null;
  /**
   * Raw calories ÷ target for the day, NEVER gated by the partial rule — used
   * by the dashboard's per-day calorie ring (progress fill). Null only when the
   * day has no logged calories (or no target).
   */
  consumedRatio: number | null;
  status: HeatmapCellStatus;
  /** A cheat meal was logged this day — rendered with a calm, distinct mark. */
  hasCheatMeal?: boolean;
}

export interface HeatmapMonthHeader {
  /** English short name. Web renders this; mobile localizes from monthIndex. */
  month: string;
  /** 1-12. Lets a client format the month in its own locale. */
  monthIndex: number;
  startColumn: number;
  span: number;
}

export interface HeatmapData {
  cells: HeatmapCell[][];
  monthHeaders: HeatmapMonthHeader[];
}

/**
 * One row of the dock's meal list.
 *
 * Carries the clock time and the three macro grams as well as the calorie
 * figure, because the row draws the Circle feed's vocabulary — name with its
 * time, the calorie figure, the composition bar, the macro figures under it —
 * and a row cannot be assembled from a label and a total.
 */
export interface MealEntry {
  id: string;
  label: string;
  calories: number;
  /** ISO timestamp; rendered as the clock time in the VIEWER's zone. */
  loggedAt: string;
  /** Grams. Null is a legacy meal whose macros were never resolved — the row
   *  drops its composition block rather than drawing a confident zero. */
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export type PaceStatus = 'on_pace' | 'ahead' | 'behind' | 'too_early';

export interface VerdictData {
  weeklyRate: number;
  totalDelta: number;
  planStartDate: string;
  status: PaceStatus;
  rollingAvg: { start: number; end: number };
  currentWeight: number;
  proteinDays: [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
}

export interface NutritionData {
  calories: { current: number; target: number };
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fat: { current: number; target: number };
}

export interface DashboardProfile {
  /** Scopes client-side query caches (e.g. the meal-confirm choreography). */
  userId: string;
  /** Which direction the user counts. Null — including an incomplete
   *  onboarding — reads as counting up, the same as bulking and maintaining. */
  goal: Goal | null;
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
}

export interface DashboardSnapshot {
  verdict: VerdictData;
  nutrition: NutritionData;
  meals: MealEntry[];
  heatmap: HeatmapData;
  weightSummary: WeightSummaryData;
}

export interface Micronutrient {
  key: string;
  name: string;
  unit: string;
  current: number;
  target: number;
  group: 'mineral' | 'vitamin' | 'other';
}
