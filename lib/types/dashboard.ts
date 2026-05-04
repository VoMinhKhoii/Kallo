import type { WeightSummaryData } from '@/lib/types/weight';

export type WeightRange = '30d' | '90d';
export type TimeRange = WeightRange;
export type HeatmapRange = '30d' | '90d' | 'year';
export type HeatmapCellStatus = 'logged' | 'unlogged' | 'future' | 'outside';

export interface HeatmapCell {
  date: string;
  ratio: number | null;
  status: HeatmapCellStatus;
}

export interface HeatmapMonthHeader {
  month: string;
  startColumn: number;
  span: number;
}

export interface HeatmapData {
  cells: HeatmapCell[][];
  monthHeaders: HeatmapMonthHeader[];
}

export interface MealEntry {
  id: string;
  label: string;
  calories: number;
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
