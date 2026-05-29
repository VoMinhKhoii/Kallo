/**
 * React Query keys for the nutrition surface — replicated EXACTLY from the web
 * (`NutritionShell`, `FoodChipRow`) so cache shape + prefix matching match.
 * Invalidations rely on TanStack prefix matching — NEVER add `exact: true`.
 *
 *   overview    ['nutrition','overview', range, tz ?? 'utc']  (web nutrition-shell.tsx)
 *   candidates  ['nutrition','candidates', nutrient]           (web food-chip-row.tsx)
 */
import type { SupportedCandidateNutrient } from '@/lib/api/contracts/nutrition';
import type { NutritionRangeInput } from '@/lib/nutrition/types';

export const nutritionKeys = {
  all: ['nutrition'] as const,
  /** 4-element key (range + timezone bucket). Invalidate with the `all` prefix. */
  overview: (range: NutritionRangeInput, tz: number | null) =>
    ['nutrition', 'overview', range, tz ?? 'utc'] as const,
  candidates: (nutrient: SupportedCandidateNutrient) =>
    ['nutrition', 'candidates', nutrient] as const,
};
