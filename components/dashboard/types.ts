export type TimeRange = '30d' | '90d';

export interface MealEntry {
  id: string;
  label: string; // user input text
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
  proteinDays: [boolean, boolean, boolean, boolean, boolean, boolean, boolean]; // Mon–Sun, true = hit protein target
}

export interface StatsData {
  streak: number;
  daysLogged: number;
  avgDeficit: number;
  todayWeight: number | null;
  weightPlaceholder: number;
}

export interface NutritionData {
  calories: { current: number; target: number };
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fat: { current: number; target: number };
}

export interface Micronutrient {
  key: string;
  name: string;
  unit: string;
  current: number;
  target: number;
  group: 'mineral' | 'vitamin' | 'other';
}

// Heatmap domain colors — references CSS custom properties for theme support
export const HEATMAP_COLORS = {
  onTarget: 'var(--nham-heatmap-on-target)',
  close: 'var(--nham-heatmap-close)',
  slight: 'var(--nham-heatmap-slight)',
  moderate: 'var(--nham-heatmap-moderate)',
  far: 'var(--nham-heatmap-far)',
} as const;

export function getHeatmapColor(ratio: number | null): {
  bg: string;
  label: string;
} {
  if (ratio === null) return { bg: 'transparent', label: 'No data' };

  const dist = Math.abs(ratio - 1.0);
  if (dist <= 0.05) return { bg: HEATMAP_COLORS.onTarget, label: 'On target' };
  if (dist <= 0.1) return { bg: HEATMAP_COLORS.close, label: 'Close' };
  if (dist <= 0.2)
    return {
      bg: HEATMAP_COLORS.slight,
      label: ratio > 1 ? 'Slightly over' : 'Slightly under',
    };
  if (dist <= 0.3)
    return {
      bg: HEATMAP_COLORS.moderate,
      label: ratio > 1 ? 'Over' : 'Under',
    };
  return {
    bg: HEATMAP_COLORS.far,
    label: ratio > 1 ? 'Far over' : 'Far under',
  };
}
